/**
 * O ponto de parada do prefetch — e, de quebra, o que se vê enquanto carrega.
 *
 * O `<Link>` do Next busca sozinho toda rota visível na tela. Para rota
 * dinâmica ele para no `loading` mais próximo; sem nenhum, não há onde parar,
 * e cada link visível renderizava a página inteira no servidor. Em produção
 * isso virou dezenas de consultas para abrir uma tela só — os prefetches do
 * painel e dos relatórios, sete consultas cada, disparados sem ninguém ter
 * clicado neles. Prefetch só acontece em produção, então nada disso aparecia
 * em desenvolvimento.
 *
 * Um arquivo aqui cobre todas as telas do app: o prefetch passa a buscar este
 * esqueleto em vez do conteúdo.
 *
 * A navegação e o cabeçalho ficam de fora porque moram no layout, que continua
 * na tela — só o miolo troca. É o que faz a navegação parecer instantânea
 * mesmo sem prefetch.
 */
export default function Carregando() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-live="polite">
      <span className="sr-only">Carregando</span>

      <div className="h-7 w-40 animate-pulse rounded-lg bg-slate-200 motion-reduce:animate-none" />

      <div className="flex flex-col gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="animate-pulse rounded-2xl bg-white p-4 ring-1 ring-slate-200 motion-reduce:animate-none"
          >
            <div className="h-4 w-2/3 rounded bg-slate-200" />
            <div className="mt-2.5 h-3 w-1/3 rounded bg-slate-100" />
          </div>
        ))}
      </div>
    </div>
  )
}
