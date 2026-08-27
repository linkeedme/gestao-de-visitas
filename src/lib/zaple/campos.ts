import { zapleGet } from './client'

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
 */
export async function listarCamposDeContato(): Promise<CampoPersonalizado[]> {
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
