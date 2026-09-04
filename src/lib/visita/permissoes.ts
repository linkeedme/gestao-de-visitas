import type { Visita } from '@/lib/db'

/**
 * Quem pode apagar uma visita, e qual.
 *
 * Apagar é a única ação do app sem volta: não há lixeira, e a linha sai do
 * banco. Por isso a regra é mais apertada que a de editar, e mora aqui em vez
 * de espalhada entre a rota e a tela — as duas precisam da mesma resposta, uma
 * para recusar e outra para nem oferecer o botão.
 *
 * O gestor apaga qualquer uma: é quem administra a operação e quem responde
 * pelo que o relatório mostra.
 *
 * O vendedor apaga só o que é dele e só o que ainda não aconteceu. Marcar por
 * engano acontece — no bolso, no carro, na pressa — e desfazer o próprio erro
 * antes da visita não tira nada de ninguém. Depois de fechada, a visita virou
 * histórico que o gestor já leu, e apagar mudaria um número depois de ele ter
 * sido usado numa conversa com a equipe. Aí passa pelo gestor.
 */
export function podeApagar(
  usuario: { id: string; papel: 'gestor' | 'vendedor' },
  visita: Pick<Visita, 'usuarioId' | 'status'>
): boolean {
  if (usuario.papel === 'gestor') return true
  if (visita.usuarioId !== usuario.id) return false
  return visita.status === 'a_fazer'
}

/**
 * Quem corrige uma visita que já aconteceu, sem reabrir antes.
 *
 * A trava existe por um bom motivo: data e cliente são o histórico que o
 * relatório do gestor já leu, e mudá-los depois altera um número que pode ter
 * sido usado numa conversa com a equipe. Para o vendedor ela continua valendo,
 * e reabrir é o caminho — porque deixa a mudança visível.
 *
 * Mas o gestor é justamente quem responde por esse relatório, e obrigá-lo a
 * reabrir e fechar de novo só para consertar o nome do cliente mexe no status
 * por um motivo que não é de status: a visita aconteceu, e continua tendo
 * acontecido enquanto o nome é corrigido. O caminho longo ainda deixava o
 * rastro errado — uma visita que apareceu como reaberta sem nunca ter sido.
 */
export function podeEditarFechada(usuario: { papel: 'gestor' | 'vendedor' }): boolean {
  return usuario.papel === 'gestor'
}
