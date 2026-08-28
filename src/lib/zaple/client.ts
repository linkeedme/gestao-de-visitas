import { ZapleError, vaTentarDeNovo } from './erros'

const TENTATIVAS = 3
const ESPERA_BASE_MS = 300

/**
 * Teto de cada tentativa. O `fetch` do Node não tem prazo nenhum por padrão:
 * uma chamada que fica sem resposta prende a requisição até o limite da
 * Vercel, e como isto roda antes de a página ou o POST responderem, quem
 * ficava parado era a pessoa segurando o celular.
 */
const POR_TENTATIVA_MS = Number(process.env.ZAPLE_TIMEOUT_MS ?? 8_000)

/**
 * Teto do conjunto, retentativas e esperas incluídas.
 *
 * Sem ele o teto por tentativa se multiplicava: três tentativas de oito
 * segundos mais o backoff passavam de vinte e cinco, o que é o mesmo travamento
 * mais devagar. Passado o orçamento, a chamada desiste com o último erro.
 */
const ORCAMENTO_MS = Number(process.env.ZAPLE_ORCAMENTO_MS ?? 12_000)

type Params = Record<string, string | string[] | number | undefined>

function montarUrl(caminho: string, params?: Params): string {
  const base = process.env.ZAPLE_BASE_URL ?? 'https://api.wts.chat'
  const url = new URL(caminho, base)
  for (const [chave, valor] of Object.entries(params ?? {})) {
    if (valor === undefined) continue
    if (Array.isArray(valor)) {
      for (const v of valor) url.searchParams.append(chave, v)
    } else {
      url.searchParams.append(chave, String(valor))
    }
  }
  return url.toString()
}

function esperar(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

/**
 * A API do Zaple sinaliza erro pelo corpo (`error: true`) e às vezes devolve
 * HTTP 200 junto. Confiar só no status deixa passar erro como se fosse dado.
 */
function conferirErro(corpo: unknown, statusHttp: number): void {
  if (
    corpo &&
    typeof corpo === 'object' &&
    'error' in corpo &&
    (corpo as { error: unknown }).error === true
  ) {
    const c = corpo as { key?: string; text?: string; httpStatusCode?: number | string }
    const status = typeof c.httpStatusCode === 'number' ? c.httpStatusCode : statusHttp
    throw new ZapleError(c.key ?? 'DESCONHECIDO', status, c.text ?? 'Erro na API do Zaple')
  }
  if (statusHttp >= 400) {
    throw new ZapleError('HTTP_' + statusHttp, statusHttp, `Zaple respondeu ${statusHttp}`)
  }
}

async function requisitar<T>(
  metodo: string,
  caminho: string,
  corpo?: unknown,
  params?: Params
): Promise<T> {
  const token = process.env.ZAPLE_TOKEN
  if (!token) throw new Error('ZAPLE_TOKEN não configurado')

  const url = montarUrl(caminho, params)
  const fim = Date.now() + ORCAMENTO_MS
  let ultimoErro: unknown

  for (let tentativa = 1; tentativa <= TENTATIVAS; tentativa++) {
    const restante = fim - Date.now()
    if (restante <= 0) break

    try {
      const resposta = await fetch(url, {
        method: metodo,
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
          ...(corpo !== undefined ? { 'Content-Type': 'application/json' } : {}),
        },
        ...(corpo !== undefined ? { body: JSON.stringify(corpo) } : {}),
        cache: 'no-store',
        signal: AbortSignal.timeout(Math.min(POR_TENTATIVA_MS, restante)),
      })

      const texto = await resposta.text()
      const dados = texto ? JSON.parse(texto) : null
      conferirErro(dados, resposta.status)
      return dados as T
    } catch (erro) {
      ultimoErro = erro
      if (!vaTentarDeNovo(erro) || tentativa === TENTATIVAS) break
      const espera = ESPERA_BASE_MS * 2 ** (tentativa - 1)
      if (fim - Date.now() <= espera) break
      await esperar(espera)
    }
  }
  throw ultimoErro ?? new Error(`Zaple não respondeu em ${ORCAMENTO_MS}ms`)
}

export const zapleGet = <T>(caminho: string, params?: Params) =>
  requisitar<T>('GET', caminho, undefined, params)

export const zaplePost = <T>(caminho: string, corpo: unknown, params?: Params) =>
  requisitar<T>('POST', caminho, corpo, params)

export const zaplePut = <T>(caminho: string, corpo: unknown) =>
  requisitar<T>('PUT', caminho, corpo)
