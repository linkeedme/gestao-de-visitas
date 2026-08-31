import { and, asc, count, countDistinct, desc, eq, gte, lte, sql } from 'drizzle-orm'
import { usuario, visita, type Visita } from '@/lib/db'
import type { BancoVisita } from './repositorio'
import { somarDias } from './datas'

export type FiltroRelatorio = {
  de: string
  ate: string
  usuarioId?: string
  status?: 'a_fazer' | 'realizada' | 'cancelada' | 'reagendada'
  contatoId?: string
}

export type LinhaRelatorio = Visita & { vendedor: string }

/**
 * As visitas do período, com quem as fez, para o gestor ler os relatos.
 *
 * Ordenada da mais recente para a mais antiga porque auditoria começa pelo
 * que acabou de acontecer — o que está fresco na cabeça de quem vai cobrar.
 */
export async function listarParaAuditoria(
  db: BancoVisita,
  f: FiltroRelatorio
): Promise<LinhaRelatorio[]> {
  const filtros = [gte(visita.data, f.de), lte(visita.data, f.ate)]
  if (f.usuarioId) filtros.push(eq(visita.usuarioId, f.usuarioId))
  if (f.status) filtros.push(eq(visita.status, f.status))
  if (f.contatoId) filtros.push(eq(visita.contatoId, f.contatoId))

  const linhas = await db
    .select({ visita, vendedor: usuario.nome })
    .from(visita)
    .innerJoin(usuario, eq(usuario.id, visita.usuarioId))
    .where(and(...filtros))
    .orderBy(desc(visita.data), desc(visita.criadaEm))
    .limit(1000)

  return linhas.map((l) => ({ ...l.visita, vendedor: l.vendedor }))
}

export type KpiVendedor = {
  usuarioId: string
  vendedor: string
  papel: 'vendedor' | 'gestor'
  realizadas: number
  canceladas: number
  reagendadas: number
  aFazer: number
  /** Clientes distintos visitados: mede alcance, não só volume. */
  clientesAlcancados: number
  /** Realizadas com relato — o que sustenta o número numa conversa. */
  comRelato: number
  /** Dias em que houve pelo menos uma visita fechada. */
  diasEmCampo: number
}

/**
 * Os números que sustentam uma cobrança.
 *
 * `clientesAlcancados` está aqui porque volume sozinho engana: dez visitas ao
 * mesmo cliente não é cobertura de carteira. E `comRelato` porque uma visita
 * marcada como realizada sem registro do que foi tratado não é auditável — o
 * gestor precisa saber quantas estão assim antes de usar o número.
 */
export async function kpisPorVendedor(
  db: BancoVisita,
  de: string,
  ate: string
): Promise<KpiVendedor[]> {
  const linhas = await db
    .select({
      usuarioId: visita.usuarioId,
      vendedor: usuario.nome,
      papel: usuario.papel,
      realizadas: count(sql`case when ${visita.status} = 'realizada' then 1 end`),
      canceladas: count(sql`case when ${visita.status} = 'cancelada' then 1 end`),
      reagendadas: count(sql`case when ${visita.status} = 'reagendada' then 1 end`),
      aFazer: count(sql`case when ${visita.status} = 'a_fazer' then 1 end`),
      clientesAlcancados: countDistinct(
        sql`case when ${visita.status} = 'realizada' then ${visita.contatoId} end`
      ),
      comRelato: count(
        sql`case when ${visita.status} = 'realizada' and ${visita.relatorio} is not null then 1 end`
      ),
      diasEmCampo: countDistinct(
        sql`case when ${visita.status} = 'realizada' then ${visita.data} end`
      ),
    })
    .from(visita)
    .innerJoin(usuario, eq(usuario.id, visita.usuarioId))
    .where(and(gte(visita.data, de), lte(visita.data, ate)))
    .groupBy(visita.usuarioId, usuario.nome, usuario.papel)

  return linhas.sort((a, b) => b.realizadas - a.realizadas)
}

export type ClienteEmRisco = {
  contatoId: string
  contatoNome: string
  ultimaVisita: string
  diasSem: number
  ultimoVendedor: string
}

/**
 * Clientes que ninguém visita há tempo demais.
 *
 * A conta é sobre a última visita REALIZADA: uma visita agendada e nunca
 * feita não conta como contato, e é justamente o padrão que faz um cliente
 * sumir sem ninguém notar — ele aparece na agenda toda semana, é reagendado
 * toda semana, e não é visitado nunca.
 */
export async function clientesEmRisco(
  db: BancoVisita,
  hojeISO: string,
  diasSemVisita: number
): Promise<ClienteEmRisco[]> {
  const linhas = await db
    .select({
      contatoId: visita.contatoId,
      contatoNome: sql<string>`max(${visita.contatoNome})`,
      ultimaVisita: sql<string>`max(${visita.data})::text`,
      ultimoVendedor: sql<string>`max(${usuario.nome})`,
    })
    .from(visita)
    .innerJoin(usuario, eq(usuario.id, visita.usuarioId))
    .where(eq(visita.status, 'realizada'))
    .groupBy(visita.contatoId)
    // O limite é calculado aqui, não no SQL: aritmética de data com parâmetro
    // no Postgres depende de o driver inferir o tipo do inteiro, e ele não
    // infere — `date - $1` vira `date < integer` e a consulta morre.
    .having(sql`max(${visita.data}) < ${somarDias(hojeISO, -diasSemVisita)}`)

  return linhas
    .map((l) => ({
      ...l,
      diasSem: Math.floor(
        (Date.parse(`${hojeISO}T00:00:00Z`) - Date.parse(`${l.ultimaVisita}T00:00:00Z`)) / 86_400_000
      ),
    }))
    .sort((a, b) => b.diasSem - a.diasSem)
}

export type CadeiaReagendamento = {
  contatoId: string
  contatoNome: string
  vezes: number
  desde: string
  vendedor: string
}

/**
 * Clientes empurrados semana após semana.
 *
 * Cada reagendamento fecha uma linha e abre outra. Contar quantas vezes o
 * mesmo cliente foi adiado no período mostra o negócio que está morrendo
 * devagar — sem cancelamento, sem recusa, sem ninguém perceber.
 */
export async function reagendamentosEmSerie(
  db: BancoVisita,
  de: string,
  ate: string,
  minimo = 2
): Promise<CadeiaReagendamento[]> {
  const linhas = await db
    .select({
      contatoId: visita.contatoId,
      contatoNome: sql<string>`max(${visita.contatoNome})`,
      vendedor: sql<string>`max(${usuario.nome})`,
      vezes: count(),
      desde: sql<string>`min(${visita.data})::text`,
    })
    .from(visita)
    .innerJoin(usuario, eq(usuario.id, visita.usuarioId))
    .where(and(eq(visita.status, 'reagendada'), gte(visita.data, de), lte(visita.data, ate)))
    .groupBy(visita.contatoId)
    .having(sql`count(*) >= ${minimo}`)

  return linhas.sort((a, b) => b.vezes - a.vezes)
}

/**
 * Visitas marcadas como realizadas sem registro do que foi tratado.
 *
 * O relato passou a ser obrigatório, mas as visitas fechadas antes disso
 * continuam sem. São elas que o gestor precisa ver antes de usar qualquer
 * número numa conversa com a equipe.
 */
export async function realizadasSemRelato(
  db: BancoVisita,
  de: string,
  ate: string
): Promise<LinhaRelatorio[]> {
  const linhas = await db
    .select({ visita, vendedor: usuario.nome })
    .from(visita)
    .innerJoin(usuario, eq(usuario.id, visita.usuarioId))
    .where(
      and(
        eq(visita.status, 'realizada'),
        gte(visita.data, de),
        lte(visita.data, ate),
        sql`(${visita.relatorio} is null or length(trim(${visita.relatorio})) < 20)`
      )
    )
    .orderBy(desc(visita.data))

  return linhas.map((l) => ({ ...l.visita, vendedor: l.vendedor }))
}

/** Visitas a fazer com data já passada — trabalho parado sem ninguém avisar. */
export async function atrasadas(db: BancoVisita, hojeISO: string): Promise<LinhaRelatorio[]> {
  const linhas = await db
    .select({ visita, vendedor: usuario.nome })
    .from(visita)
    .innerJoin(usuario, eq(usuario.id, visita.usuarioId))
    .where(and(eq(visita.status, 'a_fazer'), sql`${visita.data} < ${hojeISO}`))
    .orderBy(asc(visita.data))

  return linhas.map((l) => ({ ...l.visita, vendedor: l.vendedor }))
}

/**
 * Quem tem visita no período, para o filtro de vendedor da tela.
 *
 * Sai dos KPIs em vez de consulta própria. Era um `selectDistinct` sobre o
 * mesmo join, o mesmo intervalo e a mesma tabela que `kpisPorVendedor` já
 * percorre — uma ida ao banco inteira para devolver um subconjunto do que a
 * consulta anterior já tinha em mãos.
 *
 * A ordem é alfabética, e não a da tabela: quem procura uma pessoa numa lista
 * procura pelo nome, não por quantas visitas ela fez.
 */
export function vendedoresDoFiltro(kpis: KpiVendedor[]): { id: string; nome: string }[] {
  return kpis
    .map((k) => ({ id: k.usuarioId, nome: k.vendedor }))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
}

export type DiaSerie = {
  data: string
  realizadas: number
  canceladas: number
  reagendadas: number
  aFazer: number
}

/**
 * A série diária do período, sem buracos.
 *
 * O banco só devolve dias que tiveram visita. Um gráfico de linha montado
 * direto do resultado ligaria segunda a quinta como se quarta não existisse,
 * achatando o fim de semana e inventando uma tendência que não houve. Os dias
 * vazios entram aqui com zero.
 */
export async function serieDiaria(
  db: BancoVisita,
  de: string,
  ate: string,
  usuarioId?: string
): Promise<DiaSerie[]> {
  const filtros = [gte(visita.data, de), lte(visita.data, ate)]
  if (usuarioId) filtros.push(eq(visita.usuarioId, usuarioId))

  const linhas = await db
    .select({
      data: visita.data,
      realizadas: count(sql`case when ${visita.status} = 'realizada' then 1 end`),
      canceladas: count(sql`case when ${visita.status} = 'cancelada' then 1 end`),
      reagendadas: count(sql`case when ${visita.status} = 'reagendada' then 1 end`),
      aFazer: count(sql`case when ${visita.status} = 'a_fazer' then 1 end`),
    })
    .from(visita)
    .where(and(...filtros))
    .groupBy(visita.data)

  const porDia = new Map(linhas.map((l) => [l.data, l]))
  const serie: DiaSerie[] = []
  for (let d = de; d <= ate; d = somarDias(d, 1)) {
    serie.push(
      porDia.get(d) ?? { data: d, realizadas: 0, canceladas: 0, reagendadas: 0, aFazer: 0 }
    )
  }
  return serie
}

export type FatiaTipo = { tipo: string; n: number }

/** Distribuição por tipo de visita — que trabalho a equipe está fazendo. */
export async function porTipo(
  db: BancoVisita,
  de: string,
  ate: string
): Promise<FatiaTipo[]> {
  const linhas = await db
    .select({ tipo: visita.tipo, n: count() })
    .from(visita)
    .where(and(gte(visita.data, de), lte(visita.data, ate)))
    .groupBy(visita.tipo)

  return linhas.sort((a, b) => b.n - a.n)
}
