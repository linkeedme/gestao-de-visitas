import { redirect } from 'next/navigation'
import { linkDaGestao } from '@/lib/rotas'
import { hoje } from '@/lib/visita/datas'
import { intervaloDoFiltro } from '@/lib/visita/periodo'

export const dynamic = 'force-dynamic'

/**
 * Relatórios virou parte da gestão.
 *
 * O redirecionamento leva os filtros junto porque quem tem esta URL salva a
 * salvou com eles: um link mandado no grupo do time, um favorito aberto toda
 * segunda na reunião. Cair na tela certa com o filtro perdido é quase tão
 * ruim quanto não cair em tela nenhuma.
 */
export default async function Relatorios({ searchParams }: PageProps<'/relatorios'>) {
  const { de, ate, periodo, vendedor, status } = await searchParams
  const texto = (v: unknown) => (typeof v === 'string' && v ? v : undefined)

  // Passa pelo mesmo filtro da gestão em vez de repassar os parâmetros crus:
  // uma URL antiga que traga só `?periodo=6` sai daqui já convertida no
  // intervalo correspondente, em vez de cair no padrão de trinta dias.
  const { de: deFinal, ate: ateFinal } = intervaloDoFiltro(
    { de: texto(de), ate: texto(ate), periodo: texto(periodo) },
    hoje()
  )

  redirect(
    linkDaGestao({
      de: deFinal,
      ate: ateFinal,
      vendedor: texto(vendedor),
      status: texto(status),
    })
  )
}
