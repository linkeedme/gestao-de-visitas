import Link from 'next/link'
import { nivelDeCarga, CARGA } from '@/lib/visita/carga'
import { ListaDoDia } from './ListaDoDia'
import type { VisitaDoDia } from '@/lib/visita/repositorio'

const CURTOS = ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom']

/**
 * A semana no celular: faixa de dias em cima, lista do dia escolhido embaixo.
 *
 * Antes eram os sete dias empilhados, cada um com todos os seus cartões — uma
 * semana movimentada virava metros de rolagem, e a noção de semana se perdia
 * no meio do caminho.
 *
 * A faixa é o que distingue esta visão da de dia. Sem ela, "semana" seria só
 * "dia" com outro nome; com ela, o vendedor vê onde está a carga dos sete dias
 * e escolhe para onde ir sem sair da tela.
 *
 * A lista é o mesmo `ListaDoDia` da visão de dia, então as ações de status
 * ficam disponíveis aqui também — sem duplicar a lógica que uma correção
 * futura teria de acertar em dois lugares.
 *
 * Qual dia está aberto vem da URL, não de estado: o botão voltar funciona e o
 * link pode ser mandado para outra pessoa.
 */
export function SemanaNoCelular({
  dias,
  visitas,
  diaAtivo,
  linkDoDia,
  mostrarVendedor,
}: {
  dias: string[]
  visitas: VisitaDoDia[]
  diaAtivo: string
  linkDoDia: (data: string) => string
  mostrarVendedor: boolean
}) {
  const porDia = new Map<string, VisitaDoDia[]>(dias.map((d) => [d, []]))
  for (const v of visitas) porDia.get(v.data)?.push(v)

  const doDiaAtivo = porDia.get(diaAtivo) ?? []

  return (
    <div className="flex flex-col gap-3 lg:hidden">
      <div className="grid grid-cols-7 gap-1">
        {dias.map((d, i) => {
          const n = (porDia.get(d) ?? []).length
          const cor = CARGA[nivelDeCarga(n)]
          const ativo = d === diaAtivo

          return (
            <Link
              key={d}
              href={linkDoDia(d)}
              aria-label={`${CURTOS[i]}, dia ${Number(d.slice(8, 10))} — ${n} ${n === 1 ? 'visita' : 'visitas'}`}
              aria-current={ativo ? 'date' : undefined}
              className={`flex h-16 flex-col items-center justify-center gap-0.5 rounded-xl transition-colors ${
                ativo ? 'bg-asfalto' : cor.fundo
              }`}
            >
              <span
                className={`text-[10px] font-bold uppercase ${
                  ativo ? 'text-white/60' : 'text-slate-500'
                }`}
              >
                {CURTOS[i]}
              </span>
              <span
                className={`font-display text-base font-semibold ${
                  ativo ? 'text-white' : cor.texto
                }`}
              >
                {Number(d.slice(8, 10))}
              </span>
              <span className={`text-[10px] ${ativo ? 'text-white/60' : cor.texto}`}>
                {n || '—'}
              </span>
            </Link>
          )
        })}
      </div>

      <ListaDoDia visitas={doDiaAtivo} mostrarVendedor={mostrarVendedor} />
    </div>
  )
}
