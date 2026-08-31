import { numeroDoAmbiente } from '@/lib/ambiente'
import { zapleGet } from './client'
import { criarCacheDeChamada } from './cache'

export type CampoPersonalizado = {
  id: string
  nome: string
  /** A chave estável do campo no CRM, quando existe. */
  chave: string | null
  obrigatorio: boolean
  opcoes: string[]
}

type CampoApi = {
  id: string
  name: string
  key: string | null
  type: string
  entityType: string
  required: boolean | null
  visible: boolean | null
  options: { value?: string; name?: string }[] | null
}

/**
 * Os campos que a empresa criou na ficha de contato do CRM.
 *
 * Vêm da API em vez de ficarem escritos aqui porque quem os cria é a operação,
 * não o código: no dia em que alguém acrescentar "SEGMENTO" no Zaple, o campo
 * aparece nesta tela sozinho. Uma lista fixa aqui envelheceria em silêncio.
 *
 * Guardados por alguns minutos porque a tela de cadastrar cliente pede esta
 * lista toda vez que abre, e sem cache era uma ida à rede por abertura, no
 * meio da prospecção — com o vendedor parado na porta do cliente esperando.
 */
async function buscarCampos(): Promise<CampoPersonalizado[]> {
  const campos = await zapleGet<CampoApi[]>('/core/v1/custom-field', { PageSize: 100 })

  return campos
    .filter((c) => c.entityType === 'CONTACT' && c.visible !== false)
    .map((c) => ({
      id: c.id,
      nome: c.name,
      chave: c.key ?? null,
      // Nada é obrigatório nesta tela, mesmo que o CRM marque como tal: é
      // prospecção na rua, e o vendedor raramente tem o CNPJ do cliente que
      // acabou de conhecer. Exigir aqui faria ele desistir do cadastro.
      obrigatorio: false,
      opcoes: (c.options ?? []).map((o) => o.value ?? o.name ?? '').filter(Boolean),
    }))
}

const cache = criarCacheDeChamada<CampoPersonalizado[]>(
  numeroDoAmbiente('ZAPLE_CAMPOS_TTL_MS', 300_000)
)

export function listarCamposDeContato(): Promise<CampoPersonalizado[]> {
  return cache.obter('campos-de-contato', buscarCampos)
}

/** Esquece a lista guardada. Para teste e para os scripts de conferência. */
export function esquecerCampos(): void {
  cache.esquecer()
}
