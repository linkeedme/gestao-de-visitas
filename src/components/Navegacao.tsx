'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

/**
 * A mesma navegação em duas formas, escolhidas por CSS.
 *
 * No celular ela é uma barra no rodapé: o vendedor segura o aparelho com uma
 * mão só, em pé na porta do cliente, e o que ele usa o dia inteiro precisa
 * estar onde o polegar alcança.
 *
 * No notebook ela é uma coluna à esquerda: o gestor tem largura sobrando e
 * mouse, e uma barra no rodapé de uma tela de 15 polegadas fica longe de
 * tudo. Alternar por CSS, e não por JavaScript, evita o salto visível que a
 * detecção de largura no cliente causa no primeiro render.
 *
 * As duas ficam montadas ao mesmo tempo — o CSS esconde uma, mas o navegador
 * tem as duas. Por isso os links não fazem prefetch: cada um deles seria
 * buscado duas vezes, sem ninguém ter clicado, e são justamente os links das
 * telas mais caras (painel e relatórios fazem sete consultas cada). Medido em
 * produção: vinte e cinco requisições para abrir uma tela. O prefetch no hover
 * continua valendo, e aí o usuário já disse para onde quer ir; no celular não
 * há hover, e o custo vai a zero. O que segura a sensação de rapidez é o
 * loading.tsx, que aparece na hora do toque.
 */

type Item = { href: string; rotulo: string; icone: React.ReactNode }

function Icone({ children }: { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-6 w-6 shrink-0"
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

function montarItens(ehGestor: boolean): Item[] {
  const itens: Item[] = [
    {
      href: '/agenda',
      rotulo: 'Hoje',
      icone: (
        <Icone>
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M3 10h18M8 3v4M16 3v4" />
          <path d="m9 15 2 2 4-4" />
        </Icone>
      ),
    },
    {
      href: '/visita/nova',
      rotulo: 'Nova',
      icone: (
        <Icone>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 8v8M8 12h8" />
        </Icone>
      ),
    },
  ]

  if (ehGestor) {
    itens.push(
      {
        href: '/painel',
        rotulo: 'Painel',
        icone: (
          <Icone>
            <path d="M3 20h18" />
            <rect x="5" y="12" width="3.5" height="8" rx="1" />
            <rect x="10.25" y="7" width="3.5" height="13" rx="1" />
            <rect x="15.5" y="15" width="3.5" height="5" rx="1" />
          </Icone>
        ),
      },
      {
        href: '/relatorios',
        rotulo: 'Relatórios',
        icone: (
          <Icone>
            <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z" />
            <path d="M14 3v5h5M9 13h6M9 17h4" />
          </Icone>
        ),
      },
      {
        href: '/admin',
        rotulo: 'Equipe',
        icone: (
          <Icone>
            <circle cx="9" cy="8" r="3.5" />
            <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
            <path d="M16 5.5a3.5 3.5 0 0 1 0 6.9M17.5 20a6.5 6.5 0 0 0-2-4.7" />
          </Icone>
        ),
      }
    )
  }

  return itens
}

/** Abrir uma visita não pode apagar a aba "Hoje". */
function estaAtivo(caminho: string, href: string): boolean {
  if (href === '/agenda') {
    return caminho === '/agenda' || (caminho.startsWith('/visita/') && caminho !== '/visita/nova')
  }
  return caminho === href
}

export function BarraInferior({ ehGestor }: { ehGestor: boolean }) {
  const caminho = usePathname()
  const itens = montarItens(ehGestor)

  return (
    <nav
      aria-label="Navegação principal"
      className="sticky bottom-0 z-20 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      <ul className="mx-auto flex max-w-2xl">
        {itens.map((item) => {
          const ativo = estaAtivo(caminho, item.href)
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                prefetch={false}
                aria-current={ativo ? 'page' : undefined}
                className={`flex flex-col items-center gap-1 py-2.5 text-[11px] font-semibold tracking-wide transition-colors ${
                  ativo ? 'text-fazer' : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                {item.icone}
                {item.rotulo}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

export function BarraLateral({ ehGestor, nome }: { ehGestor: boolean; nome: string }) {
  const caminho = usePathname()
  const itens = montarItens(ehGestor)

  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-white/10 bg-asfalto lg:flex">
      <div className="px-5 py-5">
        <span className="font-display text-lg font-semibold uppercase tracking-[0.14em] text-white">
          Visitas
        </span>
        <p className="mt-0.5 text-sm text-white/50">Alta Performance</p>
      </div>

      <nav aria-label="Navegação principal" className="flex-1 px-3">
        <ul className="flex flex-col gap-1">
          {itens.map((item) => {
            const ativo = estaAtivo(caminho, item.href)
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  prefetch={false}
                  aria-current={ativo ? 'page' : undefined}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 font-semibold transition-colors ${
                    ativo ? 'bg-white/10 text-white' : 'text-white/60 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  {item.icone}
                  {item.rotulo}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      <div className="border-t border-white/10 px-5 py-4">
        <p className="truncate text-sm text-white/70">{nome}</p>
      </div>
    </aside>
  )
}
