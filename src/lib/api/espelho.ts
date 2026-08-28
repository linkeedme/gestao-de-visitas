import { after } from 'next/server'
import { sincronizar } from '@/lib/visita/sincronizador'
import { esperarAte } from '@/lib/teto'
import { numeroDoAmbiente } from '@/lib/ambiente'
import type { BancoVisita } from '@/lib/visita/repositorio'
import type { Visita } from '@/lib/db'

/**
 * Quanto tempo a resposta espera pelo espelho no CRM antes de seguir sem ele.
 *
 * O número sai da diferença entre as duas coisas que estavam empacotadas na
 * mesma espera. Gravar a visita no nosso Postgres é o trabalho: sem isso o
 * vendedor perdeu o registro. Espelhá-la no Zaple é cópia — o próprio
 * `sincronizador` foi escrito para nunca lançar, justamente porque falhar ali
 * não pode custar a visita.
 *
 * Só que o `await` amarrava as duas: marcar uma visita como realizada
 * respondia depois de ir ao Zaple buscar as etapas, gravar a nota e mover o
 * card — três idas à rede, cada uma com retentativa. Com o CRM lento, o botão
 * ficava preso. E como a tela pede `router.refresh()` logo depois, tocar em
 * duas visitas em sequência empilhava tudo isso duas vezes.
 *
 * Um segundo e meio cobre o caso normal: o Zaple responde em alguns
 * centésimos, a resposta já sai com `sincronizado_em` preenchido e a tela não
 * mostra o aviso de "não enviada ao CRM". Passou disso, quem está esperando é
 * liberado e o envio termina em `after`, depois da resposta.
 */
const PRAZO_MS = numeroDoAmbiente('SINCRONISMO_PRAZO_MS', 1_500)

/**
 * Espelha visitas no Zaple sem deixá-las prender a resposta.
 *
 * As visitas vão em paralelo, e não em fila: `reagendar` manda duas — a
 * fechada e a nova — e elas não dependem uma da outra. Em fila, a segunda só
 * começava depois de a primeira ter ido e voltado.
 */
export async function espelharNoZaple(
  db: BancoVisita,
  ...visitas: (Visita | null | undefined)[]
): Promise<void> {
  const alvos = visitas.filter((v): v is Visita => !!v)
  if (alvos.length === 0) return

  const trabalho = Promise.all(
    // `sincronizar` promete não lançar, mas quem chama aqui não pode depender
    // disso: uma rejeição solta viraria unhandled rejection depois da resposta.
    alvos.map((v) => Promise.resolve(sincronizar(db, v)).catch(() => undefined))
  )

  if (await esperarAte(trabalho, PRAZO_MS)) return
  continuarDepoisDaResposta(trabalho)
}

/**
 * Mantém o trabalho vivo depois que a resposta foi enviada.
 *
 * `after` existe para isto: na Vercel a instância é congelada assim que a
 * resposta sai, e uma promessa solta simplesmente pararia no meio — o card
 * ficaria pela metade no CRM.
 *
 * Fora de uma requisição do Next — testes, scripts — `after` não tem contexto
 * e recusa. Aí não há resposta para esperar, e deixar a promessa correr é o
 * comportamento certo.
 */
function continuarDepoisDaResposta(trabalho: Promise<unknown>): void {
  try {
    after(() => trabalho)
  } catch {
    void trabalho
  }
}
