import Link from 'next/link'
import { linkDaGestao, type FiltrosGestao } from '@/lib/rotas'
import { formatarDia, somarDias } from '@/lib/visita/datas'
import { ATALHOS } from '@/lib/visita/periodo'

const STATUS = [
  { chave: 'a_fazer', rotulo: 'A fazer' },
  { chave: 'realizada', rotulo: 'Realizada' },
  { chave: 'reagendada', rotulo: 'Reagendada' },
  { chave: 'cancelada', rotulo: 'Cancelada' },
] as const

/**
 * Tudo o que recorta a tela, num lugar só.
 *
 * Antes o período ficava no topo e pessoa e situação lá embaixo, junto da
 * lista — dois conjuntos de controle que mexem na mesma tela, separados por
 * uma tela inteira de rolagem. Quem chegava embaixo não lembrava do período
 * escolhido em cima, e quem trocava o período em cima não via o filtro de
 * pessoa mudar de resultado embaixo.
 *
 * Cada controle é um link comum, e o intervalo livre é um formulário GET: a
 * tela inteira continua sendo servidor, sem JavaScript, e cada combinação de
 * filtros tem seu próprio endereço para mandar para alguém.
 */
export function Filtros({
  filtros,
  hojeISO,
  atalhoAtivo,
  vendedores,
}: {
  filtros: FiltrosGestao
  hojeISO: string
  atalhoAtivo: number | null
  vendedores: { id: string; nome: string }[]
}) {
  const { de, ate, vendedor, status } = filtros
  const link = (troca: Partial<FiltrosGestao>) => linkDaGestao({ ...filtros, ...troca })
  const filtrando = Boolean(vendedor || status)

  return (
    <section className="flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200/70">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Período</h2>
        <p className="text-sm text-slate-500">
          {formatarDia(de)} a {formatarDia(ate)}
        </p>
      </div>

      {/* Escolher a data vem primeiro, e os atalhos depois, como atalho: com a
          ordem invertida a tela parecia oferecer só as quatro faixas prontas, e
          quem queria um mês fechado ou uma semana específica não achava onde
          pedir.

          Um GET puro: o `type="date"` abre o calendário nativo do aparelho, e
          os campos escondidos levam pessoa e situação junto, porque trocar a
          data não pode apagar o filtro que o gestor acabou de escolher. */}
      <form method="get" action="/painel" className="flex flex-wrap items-end gap-2">
        <label className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-xs font-medium text-slate-600">De</span>
          <input
            type="date"
            name="de"
            defaultValue={de}
            max={ate}
            className="min-h-11 w-full rounded-xl bg-slate-50 px-3 text-sm ring-1 ring-slate-300"
          />
        </label>
        <label className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-xs font-medium text-slate-600">Até</span>
          <input
            type="date"
            name="ate"
            defaultValue={ate}
            min={de}
            className="min-h-11 w-full rounded-xl bg-slate-50 px-3 text-sm ring-1 ring-slate-300"
          />
        </label>
        {vendedor && <input type="hidden" name="vendedor" value={vendedor} />}
        {status && <input type="hidden" name="status" value={status} />}
        <button
          type="submit"
          className="min-h-11 shrink-0 rounded-xl bg-asfalto px-5 text-sm font-semibold text-white"
        >
          Aplicar
        </button>
      </form>

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs text-slate-400">ou</span>
        {ATALHOS.map((a) => (
          <Pilula
            key={a.dias}
            href={link({ de: somarDias(hojeISO, -a.dias), ate: hojeISO })}
            ativo={a.dias === atalhoAtivo}
            rotulo={a.rotulo}
          />
        ))}
      </div>

      <div className="border-t border-slate-100 pt-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
            Quem e o quê
          </h2>
          {filtrando && (
            <Link
              href={link({ vendedor: '', status: '' })}
              prefetch={false}
              className="text-sm font-semibold text-fazer underline-offset-4 hover:underline"
            >
              limpar
            </Link>
          )}
        </div>

        <div className="mt-2 flex flex-wrap gap-1.5">
          <Pilula href={link({ vendedor: '' })} ativo={!vendedor} rotulo="Todos" />
          {vendedores.map((v) => (
            <Pilula
              key={v.id}
              href={link({ vendedor: v.id })}
              ativo={vendedor === v.id}
              rotulo={v.nome.split(' ')[0]}
            />
          ))}
        </div>

        <div className="mt-1.5 flex flex-wrap gap-1.5">
          <Pilula href={link({ status: '' })} ativo={!status} rotulo="Qualquer situação" />
          {STATUS.map((s) => (
            <Pilula
              key={s.chave}
              href={link({ status: s.chave })}
              ativo={status === s.chave}
              rotulo={s.rotulo}
            />
          ))}
        </div>
      </div>
    </section>
  )
}

function Pilula({ href, ativo, rotulo }: { href: string; ativo: boolean; rotulo: string }) {
  return (
    <Link
      href={href}
      prefetch={false}
      aria-current={ativo ? 'true' : undefined}
      className={`flex min-h-11 items-center rounded-full px-3.5 text-sm font-semibold transition-colors ${
        ativo ? 'bg-asfalto text-white' : 'bg-slate-50 text-slate-600 ring-1 ring-slate-200'
      }`}
    >
      {rotulo}
    </Link>
  )
}
