import Link from 'next/link'
import type { TotaisDoPeriodo } from '@/lib/visita/relatorios'
import { somarDias } from '@/lib/visita/datas'

/**
 * O pulso da operação, antes de qualquer detalhe.
 *
 * A tela abria direto na tabela por pessoa, e para saber se o mês tinha sido
 * bom era preciso somar as linhas de cabeça. Estes cinco números respondem
 * "como estamos" de relance; o resto da página responde "quem fez o quê".
 *
 * Cada número vem com o que ele é escrito ao lado. "31" sozinho não diz nada.
 */
export function Totais({
  totais,
  adiante,
  ate,
}: {
  totais: TotaisDoPeriodo
  adiante: number
  ate: string
}) {
  const taxa = totais.visitas === 0 ? 0 : Math.round((totais.realizadas / totais.visitas) * 100)

  return (
    <section className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-slate-200/70 ring-1 ring-slate-200/70 sm:grid-cols-3 lg:grid-cols-5">
      <Numero valor={totais.visitas} rotulo="visitas no período" />
      <Numero valor={totais.realizadas} rotulo="realizadas" tom="feita" />
      {/* A taxa fica ao lado das duas parcelas que a produzem: sozinha, um
          percentual convida a comemorar sem saber sobre quantas visitas. */}
      <Numero valor={`${taxa}%`} rotulo="do que foi marcado" />
      <Numero valor={totais.clientes} rotulo="clientes atendidos" />

      {/* O que vem depois do recorte é o único número aqui que não olha para
          trás — e é clicável, porque a pergunta seguinte é sempre "quais?". */}
      {adiante > 0 ? (
        <Link
          href={`/agenda?data=${somarDias(ate, 1)}`}
          prefetch={false}
          className="group flex flex-col gap-0.5 bg-white p-4 transition-colors hover:bg-slate-50"
        >
          <span className="font-display text-3xl font-semibold leading-none tracking-tight text-fazer">
            {adiante}
          </span>
          <span className="text-xs text-slate-500 group-hover:text-slate-700">
            marcadas à frente
          </span>
        </Link>
      ) : (
        <Numero valor={0} rotulo="marcadas à frente" />
      )}
    </section>
  )
}

function Numero({
  valor,
  rotulo,
  tom,
}: {
  valor: number | string
  rotulo: string
  tom?: 'feita'
}) {
  return (
    <div className="flex flex-col gap-0.5 bg-white p-4">
      <span
        className={`font-display text-3xl font-semibold leading-none tracking-tight ${
          tom === 'feita' ? 'text-feita' : 'text-asfalto'
        }`}
      >
        {valor}
      </span>
      <span className="text-xs text-slate-500">{rotulo}</span>
    </div>
  )
}
