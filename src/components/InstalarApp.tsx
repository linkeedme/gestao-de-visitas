'use client'
import { useEffect, useState } from 'react'
import { decidirConvite, detectarIOS, type Convite } from '@/lib/instalar'

/**
 * O convite para pôr o app na tela do celular.
 *
 * A decisão de quando aparecer mora em `@/lib/instalar`, testada à parte.
 * Aqui fica só o que depende do navegador: ouvir o aviso do Android, guardar
 * a dispensa e desenhar.
 *
 * Só no celular. No notebook o app é uma aba entre outras, e instalar não
 * muda nada do jeito que ele é usado lá.
 */
const CHAVE = 'convite-instalar-dispensado-em'

/**
 * O evento do Chrome que avisa que a instalação é possível. Não está nos
 * tipos padrão do DOM porque não é padrão: é do Chromium.
 */
type EventoDeInstalacao = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function InstalarApp() {
  const [convite, setConvite] = useState<Convite>('nenhum')
  const [nativo, setNativo] = useState<EventoDeInstalacao | null>(null)

  useEffect(() => {
    const ler = () => {
      try {
        const bruto = localStorage.getItem(CHAVE)
        return bruto ? Number(bruto) : null
      } catch {
        // Navegação privada e bloqueio de dados fazem o acesso lançar. Sem
        // memória da dispensa, o convite aparece de novo — que é melhor que a
        // tela quebrar.
        return null
      }
    }

    const avaliar = (evento: EventoDeInstalacao | null) => {
      const jaInstalado =
        window.matchMedia('(display-mode: standalone)').matches ||
        // O Safari do iPhone não implementa o display-mode e usa isto.
        (window.navigator as Navigator & { standalone?: boolean }).standalone === true

      setConvite(
        decidirConvite({
          agora: Date.now(),
          jaInstalado,
          ehIOS: detectarIOS(navigator.userAgent, navigator.maxTouchPoints > 1),
          temPromptNativo: evento !== null,
          dispensadoEm: ler(),
        })
      )
    }

    const aoPoderInstalar = (e: Event) => {
      // Sem isto o Chrome mostra a própria barra, no rodapé, competindo com a
      // navegação do app — que fica exatamente ali.
      e.preventDefault()
      const evento = e as EventoDeInstalacao
      setNativo(evento)
      avaliar(evento)
    }

    const aoInstalar = () => setConvite('nenhum')

    window.addEventListener('beforeinstallprompt', aoPoderInstalar)
    window.addEventListener('appinstalled', aoInstalar)
    avaliar(null)

    return () => {
      window.removeEventListener('beforeinstallprompt', aoPoderInstalar)
      window.removeEventListener('appinstalled', aoInstalar)
    }
  }, [])

  function dispensar() {
    try {
      localStorage.setItem(CHAVE, String(Date.now()))
    } catch {
      // Sem memória, o convite volta na próxima abertura. Aceitável.
    }
    setConvite('nenhum')
  }

  async function instalar() {
    if (!nativo) return
    await nativo.prompt()
    // Aceitando ou recusando, o evento não serve duas vezes: o Chrome só o
    // dispara de novo numa visita futura.
    setNativo(null)
    setConvite('nenhum')
  }

  if (convite === 'nenhum') return null

  return (
    <div
      role="dialog"
      aria-labelledby="convite-titulo"
      // Acima da barra de navegação, e com folga para a área segura do
      // aparelho — no iPhone a faixa do gesto de início come o rodapé.
      className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgba(15,30,43,0.12)] lg:hidden"
    >
      <div className="mx-auto flex max-w-2xl items-start gap-3">
        <img src="/icone-192.png" alt="" className="h-11 w-11 shrink-0 rounded-xl" />

        <div className="min-w-0 flex-1">
          <p id="convite-titulo" className="font-display font-semibold text-asfalto">
            Deixe o Visitas na tela do celular
          </p>

          {convite === 'nativo' ? (
            <p className="mt-0.5 text-sm text-slate-600">
              Abre direto, em tela cheia, sem procurar aba.
            </p>
          ) : (
            <p className="mt-0.5 text-sm text-slate-600">
              Toque em <Compartilhar /> na barra do Safari e escolha{' '}
              <strong className="font-semibold text-asfalto">Adicionar à Tela de Início</strong>.
            </p>
          )}

          <div className="mt-3 flex items-center gap-2">
            {convite === 'nativo' && (
              <button
                onClick={instalar}
                className="min-h-11 rounded-xl bg-asfalto px-4 font-semibold text-white"
              >
                Instalar
              </button>
            )}
            <button
              onClick={dispensar}
              className="min-h-11 rounded-xl px-3 font-semibold text-slate-500"
            >
              {convite === 'nativo' ? 'Agora não' : 'Entendi'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/** O ícone de compartilhar do iOS, desenhado para caber no meio da frase. */
function Compartilhar() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="inline-block h-[1.15em] w-[1.15em] -translate-y-[0.1em] text-fazer"
      role="img"
      aria-label="Compartilhar"
    >
      <path d="M12 15V3M8.5 6.5 12 3l3.5 3.5" />
      <path d="M7 11H5.5A1.5 1.5 0 0 0 4 12.5v6A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5v-6A1.5 1.5 0 0 0 18.5 11H17" />
    </svg>
  )
}
