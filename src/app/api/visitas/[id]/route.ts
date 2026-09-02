import { z } from 'zod'
import { exigirUsuario } from '@/lib/auth/atual'
import { buscarVisita, editarVisita, apagarVisita, db } from '@/lib/visita/repositorio'
import { apagarCard } from '@/lib/zaple/visitas'
import { espelharNoZaple } from '@/lib/api/espelho'
import { podeApagar } from '@/lib/visita/permissoes'
import { VALORES_TIPO } from '@/lib/visita/tipos'
import { erroDeValidacao } from '@/lib/api/erros'

export async function GET(_req: Request, { params }: RouteContext<'/api/visitas/[id]'>) {
  const u = await exigirUsuario()
  const { id } = await params

  const visita = await buscarVisita(db, id)
  if (!visita) return Response.json({ erro: 'Visita não encontrada' }, { status: 404 })

  if (u.papel !== 'gestor' && visita.usuarioId !== u.id) {
    return Response.json({ erro: 'Essa visita não é sua' }, { status: 403 })
  }

  return Response.json({ visita })
}

const Edicao = z
  .object({
    titulo: z.string().trim().min(1).max(500).optional(),
    descricao: z.string().trim().max(2000).nullable().optional(),
    tipo: z.enum(VALORES_TIPO).optional(),
    data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data deve ser AAAA-MM-DD').optional(),
    // Formato, e não variante RFC. `z.uuid()` do Zod 4 exige que o dígito da
    // variante seja 8, 9, a ou b, e os identificadores aqui são do CRM, não
    // nossos: recusar um id legítimo por causa de um dígito seria quebrar a
    // troca de cliente por uma regra que não é nossa para impor. O formato
    // barra o que é claramente lixo, e a coluna `uuid` do Postgres recusa o
    // resto.
    contatoId: z
      .string()
      .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, 'Escolha um cliente da lista')
      .optional(),
    contatoNome: z.string().trim().min(1).max(300).optional(),
  })
  /**
   * O nome do cliente fica congelado na visita para o relatório não depender
   * do CRM nem ser reescrito quando alguém renomeia um contato lá. Trocar um
   * sem o outro deixaria a visita apontando para um cliente e exibindo outro
   * — o pior dos dois mundos, e invisível até alguém conferir no CRM.
   */
  .refine((v) => (v.contatoId === undefined) === (v.contatoNome === undefined), {
    message: 'Para trocar o cliente, mande o contato e o nome juntos',
    path: ['contatoId'],
  })

export async function PATCH(req: Request, { params }: RouteContext<'/api/visitas/[id]'>) {
  const u = await exigirUsuario()
  const { id } = await params

  const analisado = Edicao.safeParse(await req.json().catch(() => null))
  if (!analisado.success) return erroDeValidacao(analisado.error)

  const atual = await buscarVisita(db, id)
  if (!atual) return Response.json({ erro: 'Visita não encontrada' }, { status: 404 })
  if (u.papel !== 'gestor' && atual.usuarioId !== u.id) {
    return Response.json({ erro: 'Essa visita não é sua' }, { status: 403 })
  }

  // Data e cliente de uma visita fechada são histórico: ela aconteceu naquele
  // dia, com aquele cliente. Trocar depois reescreveria o que o relatório do
  // gestor já leu. Corrigir pede reabrir antes.
  if (atual.status !== 'a_fazer') {
    const oQue = analisado.data.data ? 'a data' : analisado.data.contatoId ? 'o cliente' : null
    if (oQue) {
      return Response.json({ erro: `Para mudar ${oQue}, reabra a visita antes.` }, { status: 409 })
    }
  }

  const alterada = await editarVisita(db, id, analisado.data)
  await espelharNoZaple(db, alterada)

  return Response.json({ visita: (await buscarVisita(db, id)) ?? alterada })
}

/**
 * Apaga a visita, e o card espelho junto.
 *
 * A ordem importa: o CRM primeiro, o nosso banco depois. Se fosse ao
 * contrário e o Zaple falhasse, o card ficaria órfão sem ninguém saber qual
 * visita ele era — não haveria mais `cardId` para tentar de novo.
 *
 * Mas o CRM não tem poder de veto. A pessoa mandou apagar; se o Zaple estiver
 * fora do ar, a visita some daqui do mesmo jeito e a resposta diz que o card
 * ficou lá, em vez de deixar a tela travada num erro que ela não tem como
 * resolver.
 */
export async function DELETE(_req: Request, { params }: RouteContext<'/api/visitas/[id]'>) {
  const u = await exigirUsuario()
  const { id } = await params

  const visita = await buscarVisita(db, id)
  if (!visita) return Response.json({ erro: 'Visita não encontrada' }, { status: 404 })

  if (!podeApagar(u, visita)) {
    return Response.json(
      {
        erro:
          visita.usuarioId === u.id
            ? 'Visita que já aconteceu só o gestor apaga.'
            : 'Essa visita não é sua.',
      },
      { status: 403 }
    )
  }

  let cardApagado = true
  if (visita.cardId) {
    try {
      await apagarCard(visita.cardId)
    } catch {
      cardApagado = false
    }
  }

  await apagarVisita(db, id)

  return Response.json({ apagada: true, cardApagado })
}
