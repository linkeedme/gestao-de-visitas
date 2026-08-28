import { zapleGet } from './client'
import type { Etapa } from './tipos'

type EtapaApi = {
  id: string
  title: string
  position: number
  isInitial: boolean
  isFinal: boolean
}

type PainelApi = {
  id: string
  title: string
  steps: EtapaApi[] | null
}

type PaginaPaineisApi = {
  items: PainelApi[]
}

export function painelId(): string {
  const id = process.env.ZAPLE_PANEL_ID
  if (!id) throw new Error('ZAPLE_PANEL_ID não configurado')
  return id
}

function paraEtapas(brutas: EtapaApi[]): Etapa[] {
  return brutas
    .map((e) => ({
      id: e.id,
      titulo: e.title,
      posicao: e.position,
      inicial: e.isInitial,
      final: e.isFinal,
    }))
    .sort((a, b) => a.posicao - b.posicao)
}

async function buscarEtapas(id: string): Promise<Etapa[]> {
  const pagina = await zapleGet<PaginaPaineisApi>('/crm/v2/panel', {
    IncludeDetails: 'Steps',
    PageSize: 100,
  })

  const painel = pagina.items.find((p) => p.id === id)
  if (!painel) {
    throw new Error(`Painel ${id} não encontrado — confira ZAPLE_PANEL_ID e o escopo do token`)
  }

  return paraEtapas(painel.steps ?? [])
}

/**
 * Quanto tempo a lista de etapas vale sem ser conferida de novo.
 *
 * Etapa de painel é configuração: muda quando alguém renomeia uma coluna no
 * Zaple, o que acontece algumas vezes por ano. Buscá-la de novo a cada
 * sincronismo era uma ida à rede antes de toda gravação — duas no reagendar,
 * que sincroniza a visita fechada e a nova. Com o cache, a mesma requisição
 * paga no máximo uma, e normalmente nenhuma.
 *
 * Cinco minutos é curto o bastante para uma renomeação aparecer sozinha e
 * longo o bastante para tirar a chamada do caminho de quem está clicando.
 */
const VALIDADE_MS = Number(process.env.ZAPLE_ETAPAS_TTL_MS ?? 300_000)

let cache: { painel: string; etapas: Etapa[]; em: number } | undefined

/**
 * A busca que já está a caminho.
 *
 * Sem isto, duas sincronizações disparadas juntas — o reagendar faz
 * exatamente isso — abririam duas chamadas idênticas ao Zaple. Quem chega
 * segundo espera a mesma promessa em vez de abrir a sua.
 */
let emVoo: { painel: string; promessa: Promise<Etapa[]> } | undefined

/**
 * As etapas vêm da listagem v2, não do detalhe v1.
 *
 * Verificado contra a API de produção em 2026-08-24: `GET /crm/v1/panel/{id}`
 * devolve `steps: null` mesmo com o painel tendo quatro etapas, enquanto
 * `GET /crm/v2/panel?IncludeDetails=Steps` devolve todas preenchidas. A
 * documentação não menciona a diferença — só o teste ao vivo revelou.
 */
export async function listarEtapas(): Promise<Etapa[]> {
  const id = painelId()
  const agora = Date.now()

  if (cache && cache.painel === id && agora - cache.em < VALIDADE_MS) return cache.etapas
  if (emVoo && emVoo.painel === id) return emVoo.promessa

  const promessa = buscarEtapas(id)
  emVoo = { painel: id, promessa }

  try {
    const etapas = await promessa
    // Só o sucesso entra no cache: guardar a recusa faria um soluço do Zaple
    // valer cinco minutos.
    cache = { painel: id, etapas, em: Date.now() }
    return etapas
  } finally {
    if (emVoo?.promessa === promessa) emVoo = undefined
  }
}

/** Esquece o que está guardado. Para teste e para o script de conferência. */
export function esquecerEtapas(): void {
  cache = undefined
  emVoo = undefined
}
