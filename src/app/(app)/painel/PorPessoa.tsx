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
 * A equipe, uma linha por pessoa, com os números na mesma coluna.
 *
 * O alinhamento é a decisão principal desta tela. O trabalho do gestor é
 * comparar: quem saiu menos, quem atende poucos clientes, quem tem relato
 * faltando. Números dentro de cartões independentes ficam em posições
 * diferentes e obrigam a ler um por um; na mesma coluna, a comparação é
 * imediata e não precisa de gráfico nenhum para acontecer.
 *
 * No celular a linha vira bloco empilhado — sete colunas não cabem no polegar
 * — mas os números continuam alinhados entre si dentro de cada pessoa.
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
      <p className="rounded-xl border border-dashed border-slate-300 px-5 py-8 text-center text-sm text-slate-500">
        Ninguém registrou visita neste período.
      </p>
    )
  }

  // A barra mede volume, então todas dividem a mesma régua: quem fez menos
  // desenha uma barra menor. Normalizada por pessoa, cada uma encheria a
  // largura inteira e as três pareceriam o mesmo trabalho — apagando de vez a
  // comparação que esta tabela existe para fazer.
  const maiorCarga = Math.max(
    1,
    ...linhas.map((l) => l.realizadas + l.aFazer + l.reagendadas + l.canceladas)
  )

  return (
    <div className="overflow-hidden rounded-xl bg-white ring-1 ring-slate-200/70">
      {/* Cabeçalho de coluna só no notebook: no celular cada linha traz seus
          próprios rótulos, porque o cabeçalho sai da tela ao rolar. */}
      <div className="hidden items-end gap-4 border-b border-slate-100 px-4 py-2 text-xs font-bold uppercase tracking-wide text-slate-400 lg:flex">
        <span className="w-56 shrink-0">Pessoa</span>
        <span className="flex-1">Volume e composição</span>
        <span className="w-16 text-right">Feitas</span>
        <span className="w-16 text-right">Clientes</span>
        <span className="w-16 text-right">Em campo</span>
        <span className="w-14 text-right">%</span>
      </div>

      <ul className="divide-y divide-slate-100">
        {linhas.map((l) => {
          const marcadas = l.realizadas + l.aFazer + l.reagendadas + l.canceladas
          const semRelato = l.realizadas - l.comRelato
          const pct = marcadas === 0 ? 0 : Math.round((l.realizadas / marcadas) * 100)

          return (
            <li key={l.usuarioId}>
              <Link
                href={linkDaGestao({ ...filtros, vendedor: l.usuarioId })}
                prefetch={false}
                className="flex flex-col gap-2 px-4 py-3 transition-colors hover:bg-slate-50 lg:flex-row lg:items-center lg:gap-4"
              >
                <div className="flex min-w-0 items-baseline gap-2 lg:w-56 lg:shrink-0">
                  <span className="truncate font-display font-semibold">{l.vendedor}</span>
                  {l.papel === 'gestor' && (
                    <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                      gestor
                    </span>
                  )}
                  {semRelato > 0 && (
                    <span
                      title={`${semRelato} sem relato do que foi tratado`}
                      className="shrink-0 rounded bg-adiada/10 px-1.5 py-0.5 text-[11px] font-semibold text-adiada"
                    >
                      {semRelato} sem relato
                    </span>
                  )}
                </div>

                {/* A barra é o único desenho da tela, e ganha o espaço por
                    responder de relance o que a coluna de números responde
                    devagar: o quanto daquele trabalho virou visita feita. */}
                <div className="lg:min-w-0 lg:flex-1">
                  <div
                    className="flex h-2 gap-[2px] overflow-hidden rounded-full"
                    style={{ width: `${(marcadas / maiorCarga) * 100}%` }}
                  >
                    {FAIXAS.map((f) => {
                      const n = l[f.chave]
                      if (n === 0) return null
                      return (
                        <div
                          key={f.chave}
                          title={`${n} ${f.rotulo}`}
                          style={{ width: `${(n / marcadas) * 100}%`, backgroundColor: f.cor }}
                        />
                      )
                    })}
                  </div>
                </div>

                <div className="flex gap-5 lg:contents">
                  <Celula valor={l.realizadas} rotulo="feitas" destaque />
                  <Celula valor={l.clientesAlcancados} rotulo="clientes" />
                  <Celula valor={l.diasEmCampo} rotulo="em campo" />
                  <Celula valor={`${pct}%`} rotulo="feitas" larga={false} />
                </div>
              </Link>
            </li>
          )
        })}
      </ul>

      {/* A legenda fica no rodapé e não no topo: quem lê a tabela procura os
          números primeiro, e só volta para a cor quando estranha uma barra. */}
      <ul className="flex flex-wrap gap-x-4 gap-y-1 border-t border-slate-100 px-4 py-2">
        {FAIXAS.map((f) => (
          <li key={f.chave} className="flex items-center gap-1.5 text-xs text-slate-500">
            <span
              className="h-2 w-2 rounded-sm"
              style={{ backgroundColor: f.cor }}
              aria-hidden="true"
            />
            {f.rotulo}
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * Um número e o que ele é.
 *
 * O rótulo aparece no celular, onde não há cabeçalho de coluna para explicar,
 * e some no notebook, onde a coluna já diz — repetir ali seria dizer a mesma
 * coisa duas vezes em cada linha.
 */
function Celula({
  valor,
  rotulo,
  destaque,
  larga = true,
}: {
  valor: number | string
  rotulo: string
  destaque?: boolean
  larga?: boolean
}) {
  return (
    <div className={`lg:text-right ${larga ? 'lg:w-16' : 'lg:w-14'}`}>
      <p
        className={`font-display font-semibold tabular-nums leading-none ${
          destaque ? 'text-xl' : 'text-lg text-slate-600'
        }`}
      >
        {valor}
      </p>
      <p className="mt-0.5 text-xs text-slate-500 lg:hidden">{rotulo}</p>
    </div>
  )
}
