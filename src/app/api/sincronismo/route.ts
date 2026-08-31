import { numeroDoAmbiente } from '@/lib/ambiente'
import { exigirGestor } from '@/lib/auth/atual'
import { listarNaoSincronizadas, db } from '@/lib/visita/repositorio'
import { sincronizar } from '@/lib/visita/sincronizador'

export async function GET() {
  await exigirGestor()
  return Response.json({ pendentes: await listarNaoSincronizadas(db) })
}

/**
 * Quantas visitas o reprocessamento manda ao Zaple ao mesmo tempo.
 *
 * Uma de cada vez era o mesmo que somar as latências: com a fila em vinte
 * visitas e cada uma custando duas ou três idas à rede, o botão do admin
 * passava do teto da função antes de terminar — e quem estava esperando não
 * recebia nem o número parcial. Quatro é fila curta o bastante para não
 * atropelar o Zaple com rajada e larga o bastante para o tempo total cair na
 * mesma proporção.
 */
const LOTE = 4

/**
 * Quanto tempo o botão pode gastar antes de devolver o que conseguiu.
 *
 * Sem isto o laço não tinha fim previsível: cada visita faz até quatro
 * chamadas ao CRM em série, dez segundos de pior caso cada, o que dá quarenta
 * segundos por lote. Vinte e oito pendências bastavam para passar dos
 * trezentos segundos da Vercel — e aí a função morre sem devolver nada, o
 * gestor não recebe nem a contagem parcial, e a instância fica ocupada o
 * tempo inteiro, atendendo pior todo mundo que estiver usando o app.
 *
 * Sessenta segundos deixam folga larga sobre o teto da plataforma. O que não
 * couber fica para o próximo aperto do botão, que continua de onde parou —
 * a fila é lida do banco a cada chamada.
 */
const ORCAMENTO_MS = numeroDoAmbiente('SINCRONISMO_ORCAMENTO_MS', 60_000)

/**
 * Reprocessa a fila até onde o orçamento alcançar. Sem agendador e sem backoff
 * de propósito: com o volume de hoje, um botão no admin resolve, e um processo
 * de fundo seria infraestrutura para um problema que ainda não existe.
 */
export async function POST() {
  await exigirGestor()
  const pendentes = await listarNaoSincronizadas(db)
  const fim = Date.now() + ORCAMENTO_MS

  let sincronizadas = 0
  let tentadas = 0
  for (let i = 0; i < pendentes.length; i += LOTE) {
    // A checagem é antes do lote, e não depois: começar um lote sabendo que o
    // orçamento não o cobre é a forma de estourá-lo.
    if (Date.now() >= fim) break

    const lote = pendentes.slice(i, i + LOTE)
    const resultados = await Promise.all(lote.map((v) => sincronizar(db, v)))
    tentadas += lote.length
    sincronizadas += resultados.filter((r) => r?.ok).length
  }

  return Response.json({
    tentadas: pendentes.length,
    sincronizadas,
    // O que sobrou inclui as que nem chegaram a ser tentadas e as que
    // falharam: para quem olha a tela, as duas continuam fora do CRM.
    restantes: pendentes.length - sincronizadas,
    ...(tentadas < pendentes.length ? { pausadoPorTempo: true } : {}),
  })
}
