import Link from 'next/link'
import { nivelDeCarga, CARGA } from '@/lib/visita/carga'
import type { ContagemDoDia } from '@/lib/visita/repositorio'

/**
 * O mês inteiro em contadores.
 *
 * Não carrega as visitas de propósito: um mês cheio de uma equipe pequena
 * passa de 300 linhas, e o que a célula mostra é um número. A conta vem
 * agregada do banco.
 *
 * A carga do dia aparece como intensidade de fundo. Antes eram bolinhas, uma
 * por visita e uma cor por status — até vinte e quatro delas, de seis pixels,
 * numa célula de menos de cinquenta de largura no celular. Não se contava, não
 * se distinguia a cor, e o `title` que explicaria não existe no toque.
 *
 * A intensidade mostra o total e não mostra a divisão por status. É perda
 * deliberada: no mês a pergunta é "que dia está cheio", para escolher onde
 * entrar; a divisão por status é pergunta da visão de dia, a um toque daqui.
 *
 * As células das pontas são os dias do mês vizinho, apagadas e igualmente
 * clicáveis — a última semana de julho aparece na tela de agosto, e é ali que
 * mora metade do planejamento da virada.
 */

const CURTOS = ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom']

export function GradeDoMes({
  dias,
  mesCorrente,
  contagens,
  hojeISO,
  linkDoDia,
}: {
  dias: string[]
  /** 'AAAA-MM' do mês que a tela está mostrando. */
  mesCorrente: string
  contagens: ContagemDoDia[]
  hojeISO: string
  linkDoDia: (data: string) => string
}) {
  // O banco só devolve dias que tiveram visita; os outros entram com zero.
  // Um dia vazio é informação — é justamente o buraco que esta visão existe
  // para mostrar.
  const porDia = new Map(contagens.map((c) => [c.data, c]))

  return (
    <div className="overflow-hidden rounded-2xl bg-white p-2 shadow-sm ring-1 ring-slate-200/70">
      <div className="grid grid-cols-7">
        {CURTOS.map((c) => (
          <div
            key={c}
            className="pb-1 text-center text-xs font-bold uppercase tracking-wide text-slate-400"
          >
            {c}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {dias.map((d) => {
          const c = porDia.get(d)
          const total = c ? c.aFazer + c.realizadas + c.reagendadas + c.canceladas : 0
          const doMes = d.slice(0, 7) === mesCorrente
          const ehHoje = d === hojeISO
          const cor = CARGA[nivelDeCarga(total)]

          return (
            <Link
              key={d}
              href={linkDoDia(d)}
              prefetch={false}
              aria-label={`Dia ${Number(d.slice(8, 10))} — ${total} ${total === 1 ? 'visita' : 'visitas'}`}
              // Altura fixa: sem ela a grade pularia de tamanho ao trocar de
              // mês, conforme os dias cheios caíssem em linhas diferentes.
              // Dezesseis unidades são 64px, bem acima dos 44 do alvo de toque,
              // e permitem o mês inteiro caber sem rolagem no celular.
              className={`flex h-16 flex-col justify-between rounded-xl p-1.5 transition-colors ${
                ehHoje ? 'bg-asfalto' : doMes ? cor.fundo : 'bg-white opacity-40'
              }`}
            >
              <span
                className={`text-sm font-semibold ${
                  ehHoje ? 'text-white' : doMes ? cor.texto : 'text-slate-400'
                }`}
              >
                {Number(d.slice(8, 10))}
              </span>

              {total > 0 && (
                <span
                  className={`text-right text-xs font-semibold ${
                    ehHoje ? 'text-white/80' : doMes ? cor.texto : 'text-slate-400'
                  }`}
                >
                  {total}
                </span>
              )}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
