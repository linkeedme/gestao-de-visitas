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
 * Reprocessa a fila inteira. Sem agendador e sem backoff de propósito: com o
 * volume de hoje, um botão no admin resolve, e um processo de fundo seria
 * infraestrutura para um problema que ainda não existe.
 */
export async function POST() {
  await exigirGestor()
  const pendentes = await listarNaoSincronizadas(db)

  let sincronizadas = 0
  for (let i = 0; i < pendentes.length; i += LOTE) {
    const resultados = await Promise.all(
      pendentes.slice(i, i + LOTE).map((v) => sincronizar(db, v))
    )
    sincronizadas += resultados.filter((r) => r?.ok).length
  }

  return Response.json({ tentadas: pendentes.length, sincronizadas })
}
