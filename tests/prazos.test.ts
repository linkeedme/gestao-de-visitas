import { describe, it, expect } from 'vitest'
import { PRAZOS, DRENAGEM_MS } from '@/lib/prazos'

/**
 * A ordem dos prazos é a regra, não os valores.
 *
 * Cada prazo interno precisa vencer antes do teto da página. Estavam ao
 * contrário — teto de 8s, conexão de 10s, consulta de 15s, CRM de 12s — e o
 * efeito era que a página morria antes de qualquer causa específica disparar.
 * Sobrava sempre a mesma frase genérica no registro, e a causa real ficava
 * invisível: foram três dias diagnosticando às cegas por causa disto.
 */
describe('ordem dos prazos', () => {
  it('deixa a conexão desistir antes da consulta', () => {
    expect(PRAZOS.conectarMs).toBeLessThan(PRAZOS.consultaMs)
  })

  it('deixa cada tentativa ao CRM desistir antes do orçamento do conjunto', () => {
    expect(PRAZOS.crmTentativaMs).toBeLessThan(PRAZOS.crmOrcamentoMs)
  })

  it('deixa toda causa específica disparar antes do teto da página', () => {
    for (const [nome, prazo] of Object.entries(PRAZOS)) {
      if (nome === 'telaMs') continue
      expect(prazo, `${nome} precisa vencer antes do teto da página`).toBeLessThan(PRAZOS.telaMs)
    }
  })

  it('não deixa transação órfã sobreviver ao teto da página', () => {
    expect(PRAZOS.transacaoOciosaMs).toBeLessThan(PRAZOS.telaMs)
  })

  /**
   * Quem descarta o pool nem sempre é quem o está usando: o trabalho que
   * continua depois da resposta escreve no banco quando o CRM termina, e essa
   * escrita passa pelo mesmo `conectar()` — que pode achar a janela de
   * ociosidade vencida e descartar o pool de uma requisição recém-chegada.
   *
   * A drenagem acima do prazo de consulta é o que garante que a vítima termine
   * antes de o pool ser destruído. Se um dia alguém encurtar a drenagem ou
   * esticar a consulta, isto aqui acusa.
   */
  it('deixa a consulta terminar antes de o pool velho ser destruído', () => {
    expect(DRENAGEM_MS).toBeGreaterThan(PRAZOS.consultaMs)
  })
})
