import Link from 'next/link'
import { linkDaGestao, type FiltrosGestao } from '@/lib/rotas'
import { CORES } from './Cores'
import type { KpiVendedor } from '@/lib/visita/relatorios'

const FAIXAS = [
  { chave: 'realizadas', rotulo: 'realizadas', cor: CORES.realizadas },
  { chave: 'aFazer', rotulo: 'a fazer', cor: CORES.aFazer },
  { chave: 'reagendadas', rotulo: 'reagendadas', cor: CORES.reagendadas },
  { chave: 'canceladas', rotulo: 'canceladas', cor: CORES.canceladas },
] as const

/**
 * O time, uma pessoa por cartão.
 *
 * Substituiu os gráficos de movimento por dia e de tipo de visita. Eles
 * mostravam o time somado, e somar é justamente o que apaga a pergunta do
 * gestor: ele não precisa saber quantas visitas houve na terça, precisa saber
 * como cada pessoa está indo.
 *
 * Todo número vem com o que ele é escrito ao lado. "34" sozinho não diz nada;
 * "34 realizadas" diz. E o percentual, que antes aparecia solto como
 * "conclusão", virou a frase que ele resume.
 */
export function PorPessoa({
  linhas,
  filtros,
}: {
  linhas: KpiVendedor[]
  filtros: FiltrosGestao
}) {
  if (linhas.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-slate-300 px-5 py-8 text-center text-sm text-slate-500">
        Ninguém registrou visita neste período.
      </p>
    )
  }

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {linhas.map((l) => {
        const marcadas = l.realizadas + l.aFazer + l.reagendadas + l.canceladas
        const semRelato = l.realizadas - l.comRelato
        const pct = marcadas === 0 ? 0 : Math.round((l.realizadas / marcadas) * 100)

        return (
          <Link
            key={l.usuarioId}
            href={linkDaGestao({ ...filtros, vendedor: l.usuarioId })}
            prefetch={false}
            className="flex flex-col gap-3 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/70 transition-colors hover:bg-slate-50"
          >
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="truncate font-display text-lg font-semibold">{l.vendedor}</h3>
              {l.papel === 'gestor' && (
                <span className="shrink-0 text-xs font-bold uppercase tracking-wide text-slate-400">
                  gestor
                </span>
              )}
            </div>

            {/* Três números, cada um com o que ele é logo abaixo. */}
            <dl className="flex gap-6">
              <Numero valor={l.realizadas} rotulo="realizadas" destaque />
              <Numero valor={l.clientesAlcancados} rotulo="clientes atendidos" />
              <Numero valor={l.diasEmCampo} rotulo="dias em campo" />
            </dl>

            <div className="flex flex-col gap-1.5">
              <div className="flex h-2.5 gap-[2px] overflow-hidden rounded">
                {FAIXAS.map((f) => {
                  const n = l[f.chave]
                  if (n === 0) return null
                  return (
                    <div
                      key={f.chave}
                      style={{ width: `${(n / marcadas) * 100}%`, backgroundColor: f.cor }}
                    />
                  )
                })}
              </div>
              <p className="text-sm text-slate-600">
                <span className="font-semibold">{l.realizadas}</span> de {marcadas}{' '}
                {marcadas === 1 ? 'visita' : 'visitas'} do período — {pct}% feitas
              </p>
            </div>

            {/* Só aparece quando há o que cobrar. Uma linha em branco dizendo
                "0 sem relato" ensinaria a ignorar a área inteira. */}
            {semRelato > 0 && (
              <p className="text-sm font-medium text-adiada">
                {semRelato} {semRelato === 1 ? 'realizada' : 'realizadas'} sem relato do que foi
                tratado
              </p>
            )}
          </Link>
        )
      })}
    </div>
  )
}

function Numero({
  valor,
  rotulo,
  destaque,
}: {
  valor: number
  rotulo: string
  destaque?: boolean
}) {
  return (
    <div>
      <dd
        className={`font-display font-semibold leading-none ${
          destaque ? 'text-4xl' : 'text-2xl text-slate-600'
        }`}
      >
        {valor}
      </dd>
      <dt className="mt-1 text-xs text-slate-500">{rotulo}</dt>
    </div>
  )
}
