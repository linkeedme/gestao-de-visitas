import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

/** Lê largura e altura do cabeçalho IHDR, que são os bytes 16..24 do PNG. */
function dimensoes(caminho: string) {
  const b = readFileSync(caminho)
  const assinatura = b.subarray(0, 8).toString('hex')
  return {
    ehPng: assinatura === '89504e470d0a1a0a',
    largura: b.readUInt32BE(16),
    altura: b.readUInt32BE(20),
  }
}

describe('ícones do app', () => {
  /**
   * Os dois primeiros seguem a convenção de arquivo do App Router: o Next os
   * encontra pelo nome e escreve as tags no `<head>` sozinho. Se alguém os
   * renomear, o favicon some sem nenhum erro de build — só some.
   */
  const esperados: [string, number][] = [
    ['src/app/icon.png', 48],
    ['src/app/apple-icon.png', 180],
    ['public/icone-192.png', 192],
    ['public/icone-512.png', 512],
  ]

  it.each(esperados)('%s existe, é PNG e é quadrado no tamanho certo', (caminho, lado) => {
    const d = dimensoes(caminho)

    expect(d.ehPng, `${caminho} não é um PNG`).toBe(true)
    expect([d.largura, d.altura]).toEqual([lado, lado])
  })

  /**
   * O favicon.ico ganha do icon.png na ordem que o navegador escolhe, e o
   * projeto nasceu com o do template do Next dentro de `src/app/`. Enquanto
   * ele esteve lá, o ícone novo valeria no manifest e na tela inicial, e a aba
   * continuaria mostrando o do template — que tinha 26 KB, contra 1,3 KB deste.
   *
   * O teste olha o tamanho do arquivo justamente porque é o sintoma barato de
   * alguém ter reposto o antigo sem perceber.
   */
  it('tem um favicon.ico nosso, com os três tamanhos desenhados um a um', () => {
    const b = readFileSync('src/app/favicon.ico')

    expect(b.readUInt16LE(2), 'não é um arquivo de ícone').toBe(1)
    expect(b.readUInt16LE(4), 'deveria trazer 16, 32 e 48').toBe(3)

    const lados = [0, 1, 2].map((i) => b[6 + i * 16] || 256)
    expect(lados).toEqual([16, 32, 48])
    expect(b.length).toBeLessThan(5_000)
  })
})

describe('coerência visual entre manifest, service worker e app', () => {
  const manifest = JSON.parse(readFileSync('public/manifest.webmanifest', 'utf-8'))
  const globals = readFileSync('src/app/globals.css', 'utf-8')
  const sw = readFileSync('public/sw.js', 'utf-8')

  /**
   * O manifest usava #0b1220, que não é cor nenhuma da marca — o app pinta
   * #0f1e2b. A diferença aparece na barra de status do celular e na tela de
   * abertura do PWA, que ficavam de um tom que não existe em lugar nenhum.
   */
  it('usa o asfalto da marca, o mesmo que o CSS define', () => {
    const asfalto = globals.match(/--color-asfalto:\s*(#[0-9a-f]{6})/i)?.[1]

    expect(asfalto).toBe('#0f1e2b')
    expect(manifest.background_color).toBe(asfalto)
    expect(manifest.theme_color).toBe(asfalto)
  })

  /**
   * O service worker pré-carrega os ícones e só descarta caches de chave
   * diferente da atual. Trocar o desenho sem trocar a chave deixaria quem já
   * instalou o app com o ícone antigo, servido do cache, sem prazo para sair.
   */
  it('tem uma chave de cache mais nova que a dos ícones antigos', () => {
    const chave = sw.match(/const CACHE = '([^']+)'/)?.[1]

    expect(chave).toBeDefined()
    expect(chave).not.toBe('casco-v1')
  })
})
