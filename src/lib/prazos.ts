import { numeroDoAmbiente } from '@/lib/ambiente'

/**
 * Todos os prazos do caminho de uma requisição, num lugar só.
 *
 * Eles estavam espalhados por cinco arquivos e, sem ninguém poder vê-los lado
 * a lado, entraram em ordem invertida: o teto da página era de oito segundos,
 * a conexão desistia aos dez, a consulta aos quinze e o CRM aos doze. Todos os
 * prazos específicos venciam DEPOIS do genérico.
 *
 * O efeito prático foi caro. A página morria primeiro e sempre com a mesma
 * frase — "passou de 8s e foi abandonada" — enquanto a causa de verdade
 * disparava segundos depois, para uma corrida que já havia terminado, sem
 * nunca chegar aos registros. Foram três dias procurando uma causa que o
 * próprio instrumento apagava.
 *
 * A regra que `tests/prazos.test.ts` prende: o teto da tela é o maior de
 * todos. Quem falha específico falha primeiro, e falha com o próprio nome.
 */
export const PRAZOS = {
  /**
   * Abrir conexão. Uma saudável leva 250ms; cinco segundos é folga de vinte
   * vezes, e o que não vier nesse prazo não vem mais.
   */
  conectarMs: numeroDoAmbiente('DB_CONECTAR_MS', 5_000),

  /**
   * Consulta no servidor. As telas leem tabelas pequenas e por índice: a que
   * passa de oito segundos não está lenta, está presa, e cada uma dessas
   * ocupa uma das conexões do pool até alguém perceber.
   */
  consultaMs: numeroDoAmbiente('DB_CONSULTA_MS', 8_000),

  /**
   * Transação parada sem fazer nada. `reagendar` e `realizarComRetorno` abrem
   * transação, e uma requisição que morre no meio deixaria a conexão presa
   * com ela. Observado em desenvolvimento: uma transação órfã travou o app
   * por nove minutos, com o Postgres esperando um cliente que não voltaria.
   */
  transacaoOciosaMs: numeroDoAmbiente('DB_TRANSACAO_OCIOSA_MS', 9_000),

  /** Cada tentativa ao CRM. O `fetch` do Node não tem prazo por padrão. */
  crmTentativaMs: numeroDoAmbiente('ZAPLE_TIMEOUT_MS', 5_000),

  /**
   * O conjunto das tentativas ao CRM, esperas incluídas. Sem ele o prazo por
   * tentativa se multiplicava, e três tentativas viravam o mesmo travamento,
   * só que mais devagar.
   */
  crmOrcamentoMs: numeroDoAmbiente('ZAPLE_ORCAMENTO_MS', 10_000),

  /**
   * O teto da tela, e a última linha de defesa. Maior que todos os outros de
   * propósito: quando este é o que dispara, é porque nenhuma causa específica
   * se identificou, e isso é em si a informação.
   */
  telaMs: numeroDoAmbiente('TELA_TETO_MS', 12_000),
} as const

/** O teto da tela em segundos, que é como `comTeto` fala. */
export const TETO_DA_TELA_S = PRAZOS.telaMs / 1000

/**
 * Prazo para o pool velho terminar o que estava fazendo antes de ser
 * destruído. Fica fora de `PRAZOS` porque é o único que precisa ser MAIOR que
 * os outros, não menor — é uma drenagem, não um teto.
 *
 * Derivado do prazo de consulta em vez de escrito à mão, porque a relação
 * entre os dois é a regra: quem descarta o pool nem sempre é quem o está
 * usando, e a vítima do descarte precisa ter terminado antes.
 */
export const DRENAGEM_MS = PRAZOS.consultaMs * 2
