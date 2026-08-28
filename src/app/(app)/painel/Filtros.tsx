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

/** "22 a 28 de ago", ou "22 de jul a 28 de ago" quando atravessa o mês. */
function faixaCurta(de: string, ate: string): string {
  const m = (d: string) =>
    new Date(`${d}T12:00:00Z`).toLocaleDateString('pt-BR', { month: 'short', timeZone: 'UTC' })
      .replace('.', '')
  const d1 = Number(de.slice(8, 10))
  const d2 = Number(ate.slice(8, 10))
  return de.slice(0, 7) === ate.slice(0, 7)
    ? `${d1} a ${d2} de ${m(de)}`
    : `${d1} de ${m(de)} a ${d2} de ${m(ate)}`
}

/**
 * O recorte da tela, numa linha só até alguém querer mudá-lo.
 *
 * Antes isto era um painel que tomava quase metade da tela: dois campos de
 * data com largura de página inteira, nove pílulas em dois andares, tudo com
 * altura de alvo de toque de celular aplicada também no notebook. Filtro é
 * ferramenta, não conteúdo — e estava sendo o maior elemento da página,
 * empurrando a equipe, que é o assunto, para baixo da dobra.
 *
 * Fechado, diz o que está valendo em português: "22 a 28 de ago · toda a
 * equipe". Aberto, mostra os controles. `<details>` nativo, sem estado no
 * cliente e sem JavaScript.
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

  const quem = vendedor
    ? (vendedores.find((v) => v.id === vendedor)?.nome.split(' ')[0] ?? 'uma pessoa')
    : 'toda a equipe'
  const oQue = status ? STATUS.find((s) => s.chave === status)?.rotulo.toLowerCase() : null

  return (
    <details className="group rounded-xl bg-white ring-1 ring-slate-200/70">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-3 py-2 text-sm">
        <span className="font-semibold text-asfalto">{faixaCurta(de, ate)}</span>
        <span className="text-slate-400" aria-hidden="true">
          ·
        </span>
        <span className="truncate text-slate-600">
          {quem}
          {oQue && ` · ${oQue}`}
        </span>
        <span className="ml-auto shrink-0 text-xs font-semibold uppercase tracking-wide text-slate-400 group-open:hidden">
          mudar
        </span>
        <span className="ml-auto hidden shrink-0 text-xs font-semibold uppercase tracking-wide text-slate-400 group-open:block">
          fechar
        </span>
      </summary>

      <div className="flex flex-col gap-3 border-t border-slate-100 p-3">
        {/* Escolher a data vem antes dos atalhos: com a ordem invertida a tela
            parecia oferecer só as faixas prontas. Largura de campo de data é
            largura de data — não de página. */}
        <form method="get" action="/painel" className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-500">De</span>
            <input
              type="date"
              name="de"
              defaultValue={de}
              max={ate}
              className="h-10 w-[9.5rem] rounded-lg bg-slate-50 px-2.5 text-sm ring-1 ring-slate-300"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-500">Até</span>
            <input
              type="date"
              name="ate"
              defaultValue={ate}
              min={de}
              className="h-10 w-[9.5rem] rounded-lg bg-slate-50 px-2.5 text-sm ring-1 ring-slate-300"
            />
          </label>
          {vendedor && <input type="hidden" name="vendedor" value={vendedor} />}
          {status && <input type="hidden" name="status" value={status} />}
          <button
            type="submit"
            className="h-10 rounded-lg bg-asfalto px-4 text-sm font-semibold text-white"
          >
            Aplicar
          </button>

          <span className="ml-1 flex flex-wrap items-center gap-1">
            {ATALHOS.map((a) => (
              <Pilula
                key={a.dias}
                href={link({ de: somarDias(hojeISO, -a.dias), ate: hojeISO })}
                ativo={a.dias === atalhoAtivo}
                rotulo={a.rotulo}
              />
            ))}
          </span>
        </form>

        <div className="flex flex-wrap items-center gap-1 border-t border-slate-100 pt-3">
          <Rotulo>Quem</Rotulo>
          <Pilula href={link({ vendedor: '' })} ativo={!vendedor} rotulo="Todos" />
          {vendedores.map((v) => (
            <Pilula
              key={v.id}
              href={link({ vendedor: v.id })}
              ativo={vendedor === v.id}
              rotulo={v.nome.split(' ')[0]}
            />
          ))}

          <Rotulo className="ml-3">Situação</Rotulo>
          <Pilula href={link({ status: '' })} ativo={!status} rotulo="Qualquer" />
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
    </details>
  )
}

function Rotulo({ children, className = '' }: { children: string; className?: string }) {
  return (
    <span className={`text-xs font-bold uppercase tracking-wide text-slate-400 ${className}`}>
      {children}
    </span>
  )
}

function Pilula({ href, ativo, rotulo }: { href: string; ativo: boolean; rotulo: string }) {
  return (
    <Link
      href={href}
      prefetch={false}
      aria-current={ativo ? 'true' : undefined}
      className={`flex h-8 items-center rounded-full px-3 text-xs font-semibold transition-colors ${
        ativo
          ? 'bg-asfalto text-white'
          : 'bg-slate-50 text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100'
      }`}
    >
      {rotulo}
    </Link>
  )
}
