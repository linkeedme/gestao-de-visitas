import Link from 'next/link'
import { exigirUsuario } from '@/lib/auth/atual'
import { listarDoPeriodo, contarPorDia, db } from '@/lib/visita/repositorio'
import { hoje, diasEntre } from '@/lib/visita/datas'
import { comTeto } from '@/lib/teto'
import { TETO_DA_TELA_S } from '@/lib/prazos'
import {
  VISTAS,
  vistaValida,
  intervaloDaVista,
  passoDaVista,
  type Vista,
} from '@/lib/visita/agenda'
import { ListaDoDia } from './ListaDoDia'
import { GradeDaSemana } from './GradeDaSemana'
import { SemanaNoCelular } from './SemanaNoCelular'
import { GradeDoMes } from './GradeDoMes'

export const dynamic = 'force-dynamic'

const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']
const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
]

const ROTULO_DA_VISTA: Record<Vista, string> = { dia: 'Dia', semana: 'Semana', mes: 'Mês' }

/** Nome do dia sem passar por fuso: a data já é só uma data. */
function porExtenso(data: string): { diaSemana: string; diaMes: string } {
  const [ano, mes, dia] = data.split('-').map(Number)
  const d = new Date(Date.UTC(ano, mes - 1, dia))
  return {
    diaSemana: DIAS[d.getUTCDay()],
    diaMes: `${dia} de ${MESES[mes - 1]}`,
  }
}

function nomeDoMes(data: string): string {
  return MESES[Number(data.slice(5, 7)) - 1]
}

/** "24 a 30 de agosto", ou "31 de agosto a 6 de setembro" quando vira o mês. */
function faixaDaSemana(de: string, ate: string): string {
  const d1 = Number(de.slice(8, 10))
  const d2 = Number(ate.slice(8, 10))
  if (de.slice(0, 7) === ate.slice(0, 7)) return `${d1} a ${d2} de ${nomeDoMes(de)}`
  return `${d1} de ${nomeDoMes(de)} a ${d2} de ${nomeDoMes(ate)}`
}

export default async function Agenda({ searchParams }: PageProps<'/agenda'>) {
  const u = await exigirUsuario()
  const { data, todos, vista } = await searchParams

  // hoje() usa o fuso de São Paulo — new Date().toISOString() viraria o dia
  // às 21h no Brasil e a agenda apareceria vazia bem na hora em que o
  // vendedor está fechando o dia.
  const hojeISO = hoje()
  const dia = typeof data === 'string' ? data : hojeISO
  const v = vistaValida(vista)
  const vendoTodos = todos === '1' && u.papel === 'gestor'
  const { de, ate } = intervaloDaVista(v, dia)

  const usuarioId = vendoTodos ? undefined : u.id

  // O mês lê contagens, não visitas: são 42 células de quatro números, e
  // trazer 300 linhas com relato e nome de cliente para desenhar bolinha
  // seria trabalho jogado fora.
  const [visitas, contagens] = await comTeto('agenda:consultas', TETO_DA_TELA_S, () =>
    Promise.all([
      v === 'mes' ? Promise.resolve([]) : listarDoPeriodo(db, { de, ate, usuarioId }),
      v === 'mes' ? contarPorDia(db, { de, ate, usuarioId }) : Promise.resolve([]),
    ])
  )

  const total =
    v === 'mes'
      ? contagens.reduce((n, c) => n + c.aFazer + c.realizadas + c.reagendadas + c.canceladas, 0)
      : visitas.length
  const aFazer =
    v === 'mes'
      ? contagens.reduce((n, c) => n + c.aFazer, 0)
      : visitas.filter((x) => x.status === 'a_fazer').length
  const fechadas = total - aFazer
  const progresso = total === 0 ? 0 : Math.round((fechadas / total) * 100)
  const { diaSemana, diaMes } = porExtenso(dia)
  const ehHoje = dia === hojeISO

  /**
   * Um construtor de link para a tela inteira.
   *
   * Trocar de aba não pode perder o dia que a pessoa estava olhando, nem o
   * "ver a equipe" do gestor. Os valores padrão saem da URL para o link de
   * hoje na visão de dia ficar sendo `/agenda` limpo.
   */
  const link = (troca: { data?: string; vista?: Vista; todos?: boolean } = {}) => {
    const d = troca.data ?? dia
    const vi = troca.vista ?? v
    const t = troca.todos ?? vendoTodos
    const p = new URLSearchParams()
    if (d !== hojeISO) p.set('data', d)
    if (vi !== 'dia') p.set('vista', vi)
    if (t) p.set('todos', '1')
    const q = p.toString()
    return q ? `/agenda?${q}` : '/agenda'
  }

  const titulo =
    v === 'dia'
      ? diaMes
      : v === 'semana'
        ? faixaDaSemana(de, ate)
        : `${nomeDoMes(dia)} de ${dia.slice(0, 4)}`

  const chapeu = v === 'dia' ? (ehHoje ? 'Hoje' : diaSemana) : v === 'semana' ? 'Semana' : 'Mês'

  return (
    <div className="flex flex-col gap-5">
      {/* O cabeçalho responde de relance às duas perguntas de quem abre a
          agenda: que período é este, e quanto dele já foi fechado. */}
      <section className="overflow-hidden rounded-2xl bg-asfalto text-white shadow-sm">
        <div className="flex items-start justify-between gap-3 px-5 pt-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/50">
              {chapeu}
            </p>
            <h1 className="font-display text-3xl font-semibold leading-tight">{titulo}</h1>
          </div>

          <div className="flex items-center gap-1.5">
            <Link
              href={link({ data: passoDaVista(v, dia, -1) })}
              prefetch={false}
              aria-label="Período anterior"
              className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 text-lg text-white/80 transition-colors hover:bg-white/20"
            >
              ‹
            </Link>
            <Link
              href={link({ data: passoDaVista(v, dia, 1) })}
              prefetch={false}
              aria-label="Período seguinte"
              className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 text-lg text-white/80 transition-colors hover:bg-white/20"
            >
              ›
            </Link>
          </div>
        </div>

        <div className="flex gap-1 px-5 pt-3">
          {VISTAS.map((opcao) => (
            <Link
              key={opcao}
              href={link({ vista: opcao })}
              prefetch={false}
              aria-current={opcao === v ? 'page' : undefined}
              // 44px de altura: as abas são o controle mais usado da tela e
              // ficavam em trinta, abaixo do que o polegar acerta sem mirar.
              className={`flex min-h-11 flex-1 items-center justify-center rounded-lg px-3 text-sm font-semibold transition-colors ${
                opcao === v ? 'bg-white text-asfalto' : 'bg-white/10 text-white/70 hover:bg-white/20'
              }`}
            >
              {ROTULO_DA_VISTA[opcao]}
            </Link>
          ))}
        </div>

        <div className="flex items-baseline gap-2 px-5 pt-3">
          <span className="font-display text-2xl font-semibold">{fechadas}</span>
          <span className="text-sm text-white/60">
            de {total} {total === 1 ? 'visita' : 'visitas'}
          </span>
          {aFazer > 0 && (
            <span className="ml-auto text-sm font-medium text-white/80">
              {aFazer} {aFazer === 1 ? 'restante' : 'restantes'}
            </span>
          )}
        </div>

        {/* A barra do período. É o instrumento: uma olhada diz quanto já foi
            fechado, sem contar card nenhum. */}
        <div className="mt-3 h-1.5 w-full bg-white/10">
          <div
            className="h-full bg-feita transition-[width] duration-500"
            style={{ width: `${progresso}%` }}
          />
        </div>

        <div className="flex items-center gap-4 px-5 py-3 text-sm">
          {!ehHoje && (
            <Link
              href={link({ data: hojeISO })}
              prefetch={false}
              className="text-white/70 underline-offset-4 hover:underline"
            >
              Voltar para hoje
            </Link>
          )}
          {u.papel === 'gestor' && (
            <Link
              href={link({ todos: !vendoTodos })}
              prefetch={false}
              className="ml-auto rounded-lg bg-white/10 px-3 py-1.5 font-medium text-white/90 transition-colors hover:bg-white/20"
            >
              {vendoTodos ? 'Só as minhas' : 'Ver a equipe'}
            </Link>
          )}
        </div>
      </section>

      {v === 'dia' && <ListaDoDia visitas={visitas} mostrarVendedor={vendoTodos} />}

      {v === 'semana' && (
        <>
          <GradeDaSemana
            dias={diasEntre(de, ate)}
            visitas={visitas}
            hojeISO={hojeISO}
            mostrarVendedor={vendoTodos}
            linkDoDia={(d) => link({ data: d, vista: 'dia' })}
          />
          {/* O link da faixa mantém a visão em 'semana': tocar num dia troca
              o dia mostrado, não tira o vendedor da semana em que ele está. */}
          <SemanaNoCelular
            dias={diasEntre(de, ate)}
            visitas={visitas}
            diaAtivo={dia}
            mostrarVendedor={vendoTodos}
            linkDoDia={(d) => link({ data: d, vista: 'semana' })}
          />
        </>
      )}

      {v === 'mes' && (
        <GradeDoMes
          dias={diasEntre(de, ate)}
          mesCorrente={dia.slice(0, 7)}
          contagens={contagens}
          hojeISO={hojeISO}
          linkDoDia={(d) => link({ data: d, vista: 'dia' })}
        />
      )}
    </div>
  )
}
