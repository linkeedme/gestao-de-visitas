import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

type Conexao = ReturnType<typeof drizzle<typeof schema>>

let conexao: Conexao | undefined
let clienteAtual: ReturnType<typeof postgres> | undefined

/**
 * Joga fora o pool e obriga a próxima consulta a abrir conexão nova.
 *
 * Existe por causa de como a Vercel trata a função entre requisições: ela é
 * congelada, não encerrada. As conexões TCP morrem enquanto isso, mas o pool
 * acorda achando que ainda tem três conexões boas. A consulta então é escrita
 * num socket que ninguém atende do outro lado, e fica esperando uma resposta
 * que não vem — foi assim que o painel e a tela de equipe prenderam a função
 * pelos trezentos segundos inteiros da Vercel.
 *
 * É o que explica "abri e funcionou, saí e voltei e travou": a primeira
 * requisição abre a conexão, e a segunda herda o cadáver.
 *
 * Nenhum dos tempos-limite existentes cobre isso. `connect_timeout` vale para
 * abrir a conexão, e `statement_timeout` é imposto pelo servidor — que nunca
 * chega a receber a consulta.
 */
export function descartarConexao(): void {
  const antigo = clienteAtual
  conexao = undefined
  clienteAtual = undefined
  // Sem esperar: a conexão provavelmente já está morta, e prender o
  // encerramento aqui repetiria o problema que ele existe para resolver.
  antigo?.end({ timeout: 0 }).catch(() => {})
}

/**
 * Requisições que ainda estão usando a conexão neste instante.
 *
 * Uma instância da Vercel atende mais de uma requisição ao mesmo tempo. Sem
 * esta contagem, a primeira a terminar fecharia a conexão embaixo das outras
 * — trocando um travamento por um erro, que é pior porque parece aleatório.
 */
let emVoo = 0

export function abrirRequisicao(): void {
  emVoo++
}

/** Fecha a conexão quando a última requisição em curso termina. */
export function fecharRequisicao(): void {
  emVoo = Math.max(0, emVoo - 1)
  if (emVoo === 0) descartarConexao()
}

function conectar(): Conexao {
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
    max: Number(process.env.DB_POOL_MAX ?? 3),
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
    // O padrão da biblioteca é de trinta a sessenta MINUTOS, pensado para um
    // servidor que fica de pé. Aqui a instância dorme entre requisições e a
    // conexão morre dormindo, então guardá-la por meia hora é guardar um
    // cadáver. Um minuto é mais que suficiente para aproveitar a conexão
    // dentro de uma navegação e curto o bastante para não atravessar a soneca.
    max_lifetime: 60,
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
