/**
 * O que se vê enquanto a tela carrega.
 *
 * Este arquivo já foi descrito aqui como "o ponto de parada do prefetch", que
 * teria evitado dezenas de consultas por tela. Está errado, e fica registrado
 * em vez de apagado porque a conclusão errada custou tempo: durante três dias
 * o prefetch foi tratado como suspeito do travamento, e não era.
 *
 * O que o Next 16 realmente faz (lido em
 * `server/app-render/walk-tree-with-flight-router-state.js`): numa requisição
 * de prefetch, ao chegar no primeiro segmento que não bate com a árvore do
 * cliente, ele devolve só o estado do roteador e não monta a árvore de
 * componentes. Layout e página não renderizam. **Prefetch não custa consulta
 * nenhuma** — nem antes deste arquivo existir.
 *
 * O que os `prefetch={false}` espalhados pelo app economizam é requisição
 * HTTP, não banco.
 *
 * Este esqueleto continua valendo pelo motivo simples: é o que aparece no
 * toque, enquanto a tela de verdade vem. A navegação e o cabeçalho ficam de
 * fora porque moram no layout, que continua na tela — só o miolo troca.
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
