import type { Alerta } from '@/lib/visita/alertas'

/**
 * O bloco que pede ação, e por isso vem antes dos gráficos.
 *
 * Gráfico é contexto; alerta é trabalho. Nas duas telas antigas os alertas
 * ficavam depois dos gráficos — o urgente atrás do ilustrativo, e fora do
 * primeiro olhar de quem abre no celular.
 *
 * O tom apenas reforça o que o texto já diz. Cor sozinha não informa quem não
 * distingue as duas, então "atrasada" é uma palavra antes de ser uma cor.
 */
export function Alertas({ alertas }: { alertas: Alerta[] }) {
  if (alertas.length === 0) return null

  return (
    <section className="flex flex-col gap-2">
      <h2 className="px-1 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
        Precisa de atenção
      </h2>

      <div className="grid gap-2 lg:grid-cols-2">
        {alertas.map((a) => (
          <div key={a.chave} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200/70">
            <p className="flex items-baseline gap-2">
              <span
                className={`font-display text-2xl font-semibold ${
                  a.tom === 'urgente' ? 'text-adiada' : 'text-slate-500'
                }`}
              >
                {a.n}
              </span>
              <span className="font-semibold">{a.titulo}</span>
            </p>
            <p className="mt-0.5 text-sm text-slate-500">{a.ajuda}</p>

            <ul className="mt-2 border-t border-slate-100 pt-2 text-sm text-slate-600">
              {a.detalhe.map((d) => (
                <li key={d} className="truncate">
                  {d}
                </li>
              ))}
              {a.n > a.detalhe.length && (
                <li className="text-slate-400">e mais {a.n - a.detalhe.length}</li>
              )}
            </ul>
          </div>
        ))}
      </div>
    </section>
  )
}
