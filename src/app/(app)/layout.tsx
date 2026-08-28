import { exigirUsuario } from '@/lib/auth/atual'
import { medir } from '@/lib/medir'
import { BotaoSair } from '@/components/BotaoSair'
import { BarraInferior, BarraLateral } from '@/components/Navegacao'

export const dynamic = 'force-dynamic'

export default async function LayoutApp({ children }: LayoutProps<'/'>) {
  const u = await medir('layout:sessao', () => exigirUsuario())
  const primeiroNome = u.nome.split(' ')[0]
  const ehGestor = u.papel === 'gestor'

  return (
    <div className="flex min-h-dvh">
      <BarraLateral ehGestor={ehGestor} nome={u.nome} />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* No desktop a marca já está na lateral; aqui sobra só quem está
            logado e a saída, na ponta onde se espera encontrá-la. */}
        <header className="bg-asfalto px-4 pt-[env(safe-area-inset-top)] text-white lg:border-b lg:border-slate-200 lg:bg-white lg:text-asfalto">
          <div className="mx-auto flex w-full max-w-6xl items-center justify-between py-3">
            <span className="font-display text-lg font-semibold uppercase tracking-[0.14em] lg:hidden">
              Visitas
            </span>
            <div className="flex items-center gap-3 text-sm lg:ml-auto">
              <span className="text-white/70 lg:text-slate-500">{primeiroNome}</span>
              <BotaoSair />
            </div>
          </div>
        </header>

        {/* A coluna alarga no notebook: a tela do gestor compara números lado
            a lado, e uma faixa estreita no meio de um monitor de 15 polegadas
            desperdiça justamente o espaço que torna a comparação possível. */}
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-4 lg:px-6 lg:py-6">
          {children}
        </main>

        <BarraInferior ehGestor={ehGestor} />
      </div>
    </div>
  )
}
