import { after } from 'next/server'
import { exigirUsuario } from '@/lib/auth/atual'
import { abrirRequisicao, fecharRequisicao } from '@/lib/db'
import { medir } from '@/lib/medir'
import { BotaoSair } from '@/components/BotaoSair'
import { BarraInferior, BarraLateral } from '@/components/Navegacao'

export const dynamic = 'force-dynamic'

export default async function LayoutApp({ children }: LayoutProps<'/'>) {
  /**
   * A conexão com o banco morre com a requisição, de propósito.
   *
   * A Vercel congela a função entre requisições em vez de encerrá-la. Guardar
   * a conexão para a próxima parecia economia, mas o que ficava guardado era
   * um socket que o outro lado já tinha derrubado: a primeira requisição
   * funcionava e a seguinte escrevia num cano sem ninguém do outro lado,
   * esperando os trezentos segundos inteiros da Vercel. Aconteceu no painel,
   * na tela de equipe — que faz uma consulta só — e na agenda.
   *
   * Tentamos remendar por fora, com prazos e vida curta, e cada remendo
   * deixava uma fresta. Não guardar a conexão fecha o problema por
   * construção: não existe conexão velha se nenhuma atravessa a soneca.
   *
   * O preço é abrir uma conexão por requisição — de vinte a cinquenta
   * milésimos, agora que a função roda em São Paulo, ao lado do banco. Antes
   * dessa mudança de região seria caro; hoje é troco pelo problema que
   * elimina.
   *
   * `after` roda depois que a resposta terminou de ser enviada, então isto
   * não corta nada que ainda esteja sendo transmitido.
   */
  abrirRequisicao()
  after(() => fecharRequisicao())

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
