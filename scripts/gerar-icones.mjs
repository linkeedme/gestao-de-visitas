// Gera os ícones do app sem depender de biblioteca de imagem.
//
// O desenho é um pino de localização com um check vazado: o pino diz ONDE, o
// check diz QUE ACONTECEU — que é o par exato do que este app registra. O
// check é contra-forma, não segunda cor, então o ícone continua legível
// quando o sistema o pinta por cima ou o reduz a poucos pixels.
//
// Tudo é desenhado por campo de distância (a distância de cada pixel até a
// forma), o que dá a borda suavizada de graça e permite subtrair uma forma da
// outra com um `max`.
//
// Rode com: node scripts/gerar-icones.mjs
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'

/** As cores da marca, iguais às de globals.css. */
const ASFALTO = [0x0f, 0x1e, 0x2b]
const NEVOA = [0xee, 0xf2, 0xf6]

// --- PNG ---------------------------------------------------------------

const tabelaCrc = (() => {
  const t = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c
  }
  return t
})()

function crc32(buf) {
  let c = 0xffffffff
  for (const b of buf) c = tabelaCrc[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(tipo, dados) {
  const tamanho = Buffer.alloc(4)
  tamanho.writeUInt32BE(dados.length)
  const corpo = Buffer.concat([Buffer.from(tipo, 'ascii'), dados])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(corpo))
  return Buffer.concat([tamanho, corpo, crc])
}

function png(largura, altura, rgba) {
  const assinatura = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(largura, 0)
  ihdr.writeUInt32BE(altura, 4)
  ihdr[8] = 8 // bits por canal
  ihdr[9] = 6 // RGBA
  const linhas = Buffer.alloc(altura * (1 + largura * 4))
  for (let y = 0; y < altura; y++) {
    const inicio = y * (1 + largura * 4)
    linhas[inicio] = 0 // filtro "none"
    rgba.copy(linhas, inicio + 1, y * largura * 4, (y + 1) * largura * 4)
  }
  return Buffer.concat([
    assinatura,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(linhas, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// --- campos de distância ------------------------------------------------

/** Distância ao segmento com espessura: negativa dentro, positiva fora. */
function dSegmento(px, py, ax, ay, bx, by, espessura) {
  const dx = bx - ax
  const dy = by - ay
  const comp = dx * dx + dy * dy
  let t = comp === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / comp
  t = Math.max(0, Math.min(1, t))
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy)) - espessura
}

function dCirculo(px, py, cx, cy, raio) {
  return Math.hypot(px - cx, py - cy) - raio
}

/** Distância assinada a um polígono, pela regra do cruzamento de raio. */
function dPoligono(px, py, pontos) {
  let d = Infinity
  let dentro = false
  for (let i = 0, j = pontos.length - 1; i < pontos.length; j = i++) {
    const [ax, ay] = pontos[i]
    const [bx, by] = pontos[j]
    d = Math.min(d, dSegmento(px, py, ax, ay, bx, by, 0))
    if (ay > py !== by > py && px < ((bx - ax) * (py - ay)) / (by - ay) + ax) dentro = !dentro
  }
  return dentro ? -d : d
}

// --- o desenho ----------------------------------------------------------

/**
 * Ajuste ótico: o traço do check engrossa quando o ícone encolhe.
 *
 * Um traço de espessura proporcional que funciona a 512 pixels tem menos de um
 * pixel a 16, e o check simplesmente fecha — o vazado sumiria e sobraria uma
 * gota cega. É o mesmo motivo pelo qual as fontes têm desenhos diferentes por
 * corpo: proporção fiel não é o mesmo que leitura fiel.
 */
function espessuraDoCheck(s) {
  if (s <= 20) return 0.075
  if (s <= 40) return 0.06
  if (s <= 72) return 0.046
  return 0.038
}

/**
 * O ícone cabe na zona segura do formato maskable — o círculo central de 80%
 * — porque o Android recorta as bordas com a máscara que o aparelho usar. O
 * ponto mais distante do centro é a ponta do pino, a 25% do raio disponível de
 * 40%.
 */
function desenhar(s) {
  const rgba = Buffer.alloc(s * s * 4)
  const espessura = espessuraDoCheck(s)

  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      const px = x + 0.5
      const py = y + 0.5

      const cabeca = dCirculo(px, py, 0.5 * s, 0.415 * s, 0.205 * s)
      const ponta = dPoligono(px, py, [
        [0.345 * s, 0.505 * s],
        [0.655 * s, 0.505 * s],
        [0.5 * s, 0.75 * s],
      ])
      const gota = Math.min(cabeca, ponta)

      const check = Math.min(
        dSegmento(px, py, 0.415 * s, 0.425 * s, 0.475 * s, 0.487 * s, espessura * s),
        dSegmento(px, py, 0.475 * s, 0.487 * s, 0.598 * s, 0.343 * s, espessura * s)
      )

      // Subtrai o check da gota: max(forma, -buraco).
      const d = Math.max(gota, -check)

      // A faixa de um pixel entre dentro e fora vira a suavização da borda.
      const cobertura = Math.max(0, Math.min(1, 0.5 - d))

      const i = (y * s + x) * 4
      for (let c = 0; c < 3; c++) {
        rgba[i + c] = Math.round(ASFALTO[c] + (NEVOA[c] - ASFALTO[c]) * cobertura)
      }
      rgba[i + 3] = 255
    }
  }

  return png(s, s, rgba)
}

/**
 * Empacota PNGs num .ico.
 *
 * O formato aceita PNG inteiro dentro de cada entrada, então não é preciso
 * escrever bitmap: é só um índice de 6 bytes, uma entrada de 16 por imagem e
 * os PNGs concatenados no fim.
 *
 * Existe porque `favicon.ico` ganha do `icon.png` na ordem que o navegador
 * escolhe, e o projeto nasceu com o favicon do template do Next dentro de
 * `src/app/`. Sem substituí-lo, o ícone novo entraria no manifest e na tela
 * inicial, mas a aba continuaria mostrando o antigo.
 */
function ico(tamanhos) {
  const imagens = tamanhos.map((s) => ({ s, dados: desenhar(s) }))

  const cabecalho = Buffer.alloc(6)
  cabecalho.writeUInt16LE(0, 0) // reservado
  cabecalho.writeUInt16LE(1, 2) // 1 = ícone
  cabecalho.writeUInt16LE(imagens.length, 4)

  let deslocamento = 6 + imagens.length * 16
  const entradas = imagens.map(({ s, dados }) => {
    const e = Buffer.alloc(16)
    e[0] = s >= 256 ? 0 : s // 0 significa 256
    e[1] = s >= 256 ? 0 : s
    e[2] = 0 // cores da paleta: 0, porque é imagem direta
    e[3] = 0 // reservado
    e.writeUInt16LE(1, 4) // planos
    e.writeUInt16LE(32, 6) // bits por pixel
    e.writeUInt32LE(dados.length, 8)
    e.writeUInt32LE(deslocamento, 12)
    deslocamento += dados.length
    return e
  })

  return Buffer.concat([cabecalho, ...entradas, ...imagens.map((i) => i.dados)])
}

/**
 * Onde cada arquivo é usado:
 *
 * - `src/app/favicon.ico`, `icon.png` e `apple-icon.png` seguem a convenção de
 *   arquivo do App Router: o Next acha os três sozinho e escreve as tags no
 *   `<head>`. Não precisam ser declarados no metadata.
 * - `public/icone-192.png` e `-512.png` são os que o manifest aponta, e os que
 *   o Android usa ao instalar o app na tela inicial.
 */
const arquivos = [
  ['src/app/icon.png', 48],
  ['src/app/apple-icon.png', 180],
  ['public/icone-192.png', 192],
  ['public/icone-512.png', 512],
]

for (const [caminho, tamanho] of arquivos) {
  mkdirSync(caminho.slice(0, caminho.lastIndexOf('/')), { recursive: true })
  writeFileSync(caminho, desenhar(tamanho))
  console.log(`gerado ${caminho} (${tamanho}px)`)
}

// Os três tamanhos que a aba, a lista de favoritos e o atalho de área de
// trabalho pedem. Cada um é desenhado no seu tamanho, e não reduzido do maior:
// é isso que mantém o check aberto a 16 pixels.
writeFileSync('src/app/favicon.ico', ico([16, 32, 48]))
console.log('gerado src/app/favicon.ico (16, 32, 48px)')
