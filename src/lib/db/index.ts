import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { numeroDoAmbiente } from '@/lib/ambiente'
import { PRAZOS } from '@/lib/prazos'
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
    // Doze, e não três, porque três era o que produzia o travamento.
    //
    // A tela de gestão pede oito consultas de uma vez. Com três conexões elas
    // viravam três ondas, e — pior — o que sobrava ia para uma fila FIFO única
    // do cliente inteiro, sem prazo e sem prioridade. Quem clicasse noutra
    // tela entrava atrás da bagagem inteira da anterior, e como nada cancela
    // consulta de tela abandonada, o segundo clique herdava a fila do
    // primeiro. Era exatamente o "trava quando clico rápido".
    //
    // O `prepare: false` acima piora a conta: ele desliga o pipelining do
    // driver, então o pool não sobrepõe consultas — é um portão de `max` por
    // vez, sem folga.
    //
    // Doze conexões por instância não pressionam o pooler de transação, que
    // existe justamente para multiplexar muitos clientes sobre poucas conexões
    // reais do Postgres, e cabem com sobra no limite do projeto.
    //
    // Cai para 1 com DB_POOL_MAX=1, que é o que o Postgres embarcado do
    // desenvolvimento local exige: o PGlite serve tudo por uma conexão só, e
    // multiplexa mal statements concorrentes. Como o /painel dispara três
    // consultas em paralelo, com pool maior que 1 ele responde
    // "unnamed prepared statement does not exist" e a tela quebra — só
    // localmente, nunca contra um Postgres de verdade.
    max: numeroDoAmbiente('DB_POOL_MAX', 12),
    idle_timeout: 20,
    // Os prazos viajam no handshake, então uma conexão que nunca se
    // estabelece nunca os recebe. Sem o de conectar, o `await` fica pendurado
    // até o teto da Vercel — 300 segundos. Observado em produção: um soluço do
    // banco às 10:53 travou quatro requisições do painel e uma de relatórios
    // por cinco minutos cada, segurando conexões e realimentando a fila.
    //
    // Os valores moram em `prazos.ts` porque a ordem entre eles é que importa,
    // e ela só se enxerga com todos lado a lado.
    connect_timeout: PRAZOS.conectarMs / 1000,
    connection: {
      statement_timeout: PRAZOS.consultaMs,
      idle_in_transaction_session_timeout: PRAZOS.transacaoOciosaMs,
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
