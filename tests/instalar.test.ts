import { describe, it, expect } from 'vitest'
import { decidirConvite, DISPENSA_DIAS } from '@/lib/instalar'

const AGORA = Date.parse('2026-09-01T12:00:00Z')

const base = {
  agora: AGORA,
  jaInstalado: false,
  ehIOS: false,
  temPromptNativo: false,
  dispensadoEm: null as number | null,
}

describe('decidirConvite', () => {
  /**
   * Quem já instalou abre o app pela tela inicial, e o app roda em
   * standalone. Convidar de novo ali é oferecer o que a pessoa já tem.
   */
  it('não convida quem já instalou', () => {
    expect(decidirConvite({ ...base, jaInstalado: true, temPromptNativo: true })).toBe('nenhum')
    expect(decidirConvite({ ...base, jaInstalado: true, ehIOS: true })).toBe('nenhum')
  })

  /**
   * No Android o navegador avisa que a instalação é possível, e só então há
   * o que oferecer: sem esse aviso, o botão não teria o que chamar.
   */
  it('oferece o botão nativo quando o navegador diz que dá para instalar', () => {
    expect(decidirConvite({ ...base, temPromptNativo: true })).toBe('nativo')
  })

  it('não inventa botão quando o navegador não ofereceu instalação', () => {
    expect(decidirConvite(base)).toBe('nenhum')
  })

  /**
   * O iPhone nunca dispara o evento de instalação: no Safari o caminho é
   * Compartilhar e "Adicionar à Tela de Início", e a única coisa que o app
   * pode fazer é ensinar. Por isso o iOS tem convite próprio, sem depender
   * de aviso nenhum do navegador.
   */
  it('ensina o caminho manual no iPhone, mesmo sem aviso do navegador', () => {
    expect(decidirConvite({ ...base, ehIOS: true })).toBe('ensinar-ios')
  })

  it('some depois de a pessoa dispensar', () => {
    const ontem = AGORA - 24 * 60 * 60 * 1000
    expect(decidirConvite({ ...base, temPromptNativo: true, dispensadoEm: ontem })).toBe('nenhum')
    expect(decidirConvite({ ...base, ehIOS: true, dispensadoEm: ontem })).toBe('nenhum')
  })

  /**
   * Dispensar não é "nunca mais": quem recusou no primeiro dia de uso pode
   * querer instalar depois de duas semanas usando pelo navegador. Insistir
   * todo dia seria propaganda; nunca mais voltar desperdiça o interesse que
   * o uso cria.
   */
  it('volta a convidar depois do prazo da dispensa', () => {
    const velho = AGORA - (DISPENSA_DIAS + 1) * 24 * 60 * 60 * 1000
    expect(decidirConvite({ ...base, temPromptNativo: true, dispensadoEm: velho })).toBe('nativo')
  })
})
