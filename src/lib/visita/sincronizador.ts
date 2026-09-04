import {
  criarVisita as criarCardZaple,
  atualizarVisita as atualizarCard,
  moverEtapa,
  gravarNota,
} from '@/lib/zaple/visitas'
import { listarEtapas } from '@/lib/zaple/painel'
import { marcarSincronizada, marcarCard, type BancoVisita } from './repositorio'
import { etapaParaStatus } from './etapas'
import { rotuloDoTipo } from './tipos'
import type { Visita } from '@/lib/db'

/**
 * O título do card é o nome do cliente. Sempre.
 *
 * Antes ia o título da visita, que é campo livre e que as pessoas preenchem
 * com o motivo — "Levar tabela nova", "Cobrar pedido". O painel do CRM é
 * organizado por cliente, e uma coluna de frases soltas não deixa ninguém
 * achar a empresa que procura.
 */
function tituloDoCard(v: Visita): string {
  return v.contatoNome
}

/**
 * A descrição carrega o resto: o motivo escrito antes de ir, o tipo da visita
 * e o título quando ele disser algo além do nome do cliente.
 *
 * O título da visita entra aqui, e não se perde, porque foi onde as pessoas
 * escreveram o motivo esse tempo todo — jogá-lo fora ao mudar o campo do card
 * apagaria informação que já está lançada.
 */
function descricaoDoCard(v: Visita): string {
  const partes = [rotuloDoTipo(v.tipo)]
  if (v.titulo && v.titulo.trim() !== v.contatoNome.trim()) partes.push(v.titulo.trim())
  if (v.descricao?.trim()) partes.push(v.descricao.trim())
  return partes.join('\n')
}

/**
 * Espelha a visita no Zaple. **Nunca lança.**
 *
 * Esta é a inversão inteira em uma função: o dado já está salvo no nosso
 * Postgres quando isto roda. Se o Zaple recusar, estiver fora do ar ou tiver
 * o painel configurado de um jeito que não esperávamos, o resultado é uma
 * visita com `sincronizado_em` nulo — nunca um vendedor na rua sem conseguir
 * registrar o que acabou de fazer.
 */
export async function sincronizar(
  db: BancoVisita,
  v: Visita
): Promise<{ ok: boolean; erro?: string }> {
  try {
    // Sem responsável no CRM não há card: o Zaple recusa card sem atendente,
    // e o gestor que administra o sistema não é atendente lá. A visita fica
    // sem espelho, registrada aqui, em vez de o trabalho ser recusado.
    if (!v.zapleUserId) {
      return { ok: false, erro: 'Quem criou esta visita não tem agente no CRM.' }
    }

    const etapas = await listarEtapas()
    let cardId = v.cardId

    if (!cardId) {
      const etapaInicial = etapaParaStatus(etapas, 'a_fazer') ?? etapas.find((e) => e.inicial)
      if (!etapaInicial) return { ok: false, erro: 'O painel do Zaple não tem etapa inicial.' }

      const card = await criarCardZaple({
        etapaId: etapaInicial.id,
        titulo: tituloDoCard(v),
        descricao: descricaoDoCard(v),
        responsavelId: v.zapleUserId,
        contatoIds: [v.contatoId],
        // Meio-dia UTC: com 00:00 o fuso do Brasil empurraria o card para o
        // dia anterior no Zaple.
        prazo: `${v.data}T12:00:00.000Z`,
      })
      cardId = card.id
      // Persistir agora, e não só no fim: se a nota ou a movimentação falhar,
      // a próxima tentativa reusa este card em vez de criar outro.
      await marcarCard(db, v.id, cardId)
    } else {
      // Card que já existe tem o conteúdo revisto, e não só a etapa movida.
      //
      // Sem isto, trocar o cliente de uma visita nunca chegava ao CRM: o card
      // continuava na ficha da empresa errada, que é justamente o erro que a
      // troca existe para consertar. O mesmo vale para o título e para a data
      // corrigidos depois.
      await atualizarCard(cardId, {
        titulo: tituloDoCard(v),
        descricao: descricaoDoCard(v),
        contatoIds: [v.contatoId],
        prazo: `${v.data}T12:00:00.000Z`,
      })
    }

    // Só grava se o texto mudou desde a última vez que chegou lá.
    const notaMudou = !!v.relatorio && v.relatorio !== v.relatorioNoZaple
    if (notaMudou) await gravarNota(cardId, v.relatorio!)

    // A etapa pode não existir: o painel é configurado por gente, e enquanto
    // não for renomeado não há "Cancelada" lá. Não mover é aceitável; travar
    // o sincronismo por causa disso não é.
    //
    // `a_fazer` não move porque o card nasce na etapa inicial — mover para
    // onde ele já está seria uma chamada à toa a cada sincronismo.
    const destino = etapaParaStatus(etapas, v.status)
    if (destino && v.status !== 'a_fazer') {
      await moverEtapa(cardId, destino.id)
    }

    await marcarSincronizada(db, v.id, cardId, notaMudou ? v.relatorio : undefined)
    return { ok: true }
  } catch (erro) {
    return { ok: false, erro: erro instanceof Error ? erro.message : 'Falha ao falar com o Zaple' }
  }
}
