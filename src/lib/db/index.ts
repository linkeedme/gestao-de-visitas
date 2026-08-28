import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { numeroDoAmbiente } from '@/lib/ambiente'
import * as schema from './schema'

type Conexao = ReturnType<typeof drizzle<typeof schema>>

let conexao: Conexao | undefined
let clienteAtual: ReturnType<typeof postgres> | undefined

/** Relógio da última vez que alguém pediu o banco. */
let ultimoUso = 0

/**
 * Quanto tempo parado basta para não confiar mais no pool.
 *
 * O problema original continua real: a Vercel congela a função entre
 * requisições em vez de encerrá-la, as conexões TCP morrem durante a soneca, e
 * o pool acorda achando que ainda tem três conexões boas. A consulta é escrita
 * num socket que ninguém atende e fica esperando uma resposta que não vem.
 *
 * O que mudou é ONDE a conexão é jogada fora. Antes era na saída de cada
 * requisição, e isso trocava o travamento por outro: numa instância que atende
 * mais de uma requisição ao mesmo tempo, a primeira a terminar fechava o pool
 * embaixo das outras. Era o que travava o app quando se tocava em duas coisas
 * seguidas — a navegação terminava, matava a conexão, e o POST que ainda
 * estava gravando morria com ela ou ficava pendurado.
 *
 * Agora a troca é na ENTRADA e por idade: se ninguém usou o banco nos últimos
 * dez segundos, houve tempo de sobra para a instância ter congelado, então a
 * próxima consulta nasce com pool novo. Dois cliques em sequência caem dentro
 * da janela e compartilham o mesmo pool quente — nenhum deles derruba o outro,
 * e nenhum paga um handshake novo.
 *
 * `DB_OCIOSIDADE_MAX_MS` regula a janela. Um valor bem baixo volta ao
 * comportamento antigo, de conexão nova a cada requisição.
 */
const OCIOSIDADE_MAXIMA_MS = numeroDoAmbiente('DB_OCIOSIDADE_MAX_MS', 10_000)

/**
 * Prazo para o pool velho terminar o que estava fazendo antes de ser
 * destruído.
 *
 * Alinhado ao `statement_timeout`: consulta que o servidor ainda honraria
 * chega ao fim; a que já estava presa morre junto com o pool, que é o
 * desfecho desejado. `timeout: 0` destruiria o socket na hora e mataria
 * consulta em voo — foi o que produziu CONNECTION_DESTROYED em produção.
 */
const DRENAGEM_S = 15

/** Joga fora o pool e obriga a próxima consulta a abrir conexão nova. */
export function descartarConexao(): void {
  const antigo = clienteAtual
  conexao = undefined
  clienteAtual = undefined
  antigo?.end({ timeout: DRENAGEM_S }).catch(() => {})
}

function conectar(): Conexao {
  const agora = Date.now()
  if (conexao && agora - ultimoUso > OCIOSIDADE_MAXIMA_MS) descartarConexao()
  ultimoUso = agora

  if (conexao) return conexao

  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL não configurado')

  const cliente = postgres(url, {
    // O pooler de transação do Supabase (porta 6543) não suporta prepared
    // statements: cada requisição pode cair numa conexão diferente do pool,
    // e o statement preparado na anterior não existe lá. Sem isso, o app
    // funciona no primeiro acesso e falha de forma intermitente depois.
    prepare: false,
    // Serverless: cada instância é efêmera, então um punhado de conexões por
    // instância basta e evita estourar o limite do projeto.
    //
    // Cai para 1 com DB_POOL_MAX=1, que é o que o Postgres embarcado do
    // desenvolvimento local exige: o PGlite serve tudo por uma conexão só, e
    // multiplexa mal statements concorrentes. Como o /painel dispara três
    // consultas em paralelo, com pool maior que 1 ele responde
    // "unnamed prepared statement does not exist" e a tela quebra — só
    // localmente, nunca contra um Postgres de verdade.
    max: numeroDoAmbiente('DB_POOL_MAX', 3),
    idle_timeout: 20,
    // O teto que faltava, e o mais caro de não ter: os timeouts abaixo viajam
    // no handshake, então uma conexão que nunca se estabelece nunca os recebe.
    // Sem isto o `await` fica pendurado até o teto da Vercel — 300 segundos.
    // Observado em produção: um soluço do banco às 10:53 travou quatro
    // requisições do painel e uma de relatórios por cinco minutos cada,
    // segurando conexões e realimentando a fila. Uma conexão saudável leva
    // 250ms; a que não vier em 10s não vem mais, e falhar rápido devolve à
    // pessoa uma tela com recado em vez de cinco minutos de espera.
    connect_timeout: 10,
    connection: {
      // Uma consulta que passa de 15s aqui não está lenta, está presa: as
      // telas leem tabelas pequenas e por índice. Sem teto, ela ocupa uma das
      // três conexões até alguém perceber.
      statement_timeout: 15_000,
      // O teto que importa de verdade. `reagendar` e `realizarComRetorno`
      // abrem transação, e uma requisição que morre no meio — o serverless
      // desligando a instância, o navegador desistindo — deixaria a transação
      // aberta segurando a conexão. Observado em desenvolvimento: uma
      // transação órfã travou o app inteiro por nove minutos, com o Postgres
      // parado em Client/ClientRead esperando um cliente que não voltaria.
      idle_in_transaction_session_timeout: 10_000,
    },
  })

  clienteAtual = cliente
  conexao = drizzle(cliente, { schema })
  return conexao
}

/**
 * Conexão preguiçosa de propósito: se o erro fosse lançado no import, o build
 * e os testes passariam a exigir um banco de verdade só para carregar módulos
 * que talvez nem consultem nada.
 */
export const db = new Proxy({} as Conexao, {
  get: (_alvo, prop) => Reflect.get(conectar(), prop),
})

export * from './schema'
