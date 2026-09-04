'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { erroDaResposta } from '@/lib/api/cliente'
import type { Visita } from '@/lib/db'

/**
 * Devolve para "a fazer" o que foi fechado.
 *
 * O botão existia na agenda e não aqui, e esta é a tela em que a pessoa
 * percebe o erro: ela abre a visita para conferir o que registrou, vê que
 * fechou a errada, e não tinha o que fazer a não ser voltar para a lista e
 * procurar de novo.
 *
 * `reagendada` fica de fora porque a substituta dela já existe: reabrir a
 * antiga criaria duas visitas vivas para o mesmo compromisso.
 */
export function ReabrirVisita({ visita }: { visita: Visita }) {
  const router = useRouter()
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  if (visita.status !== 'realizada' && visita.status !== 'cancelada') return null

  async function reabrir() {
    setOcupado(true)
    setErro(null)
    try {
      const r = await fetch(`/api/visitas/${visita.id}/status`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status: 'a_fazer' }),
      })
      if (!r.ok) {
        setErro(await erroDaResposta(r, 'Não foi possível reabrir'))
        return
      }
      router.refresh()
    } catch {
      setErro('Sem conexão. A visita não foi reaberta.')
    } finally {
      setOcupado(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {erro && (
        <p role="alert" className="text-sm font-medium text-red-700">
          {erro}
        </p>
      )}
      <button
        onClick={reabrir}
        disabled={ocupado}
        className="flex min-h-11 items-center gap-2 self-start rounded-xl px-4 font-semibold text-slate-600 ring-1 ring-inset ring-slate-300 transition-colors hover:bg-white disabled:opacity-50"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-4 w-4"
          aria-hidden="true"
        >
          <path d="M3 12a9 9 0 1 0 3-6.7M3 4v5h5" />
        </svg>
        {ocupado ? 'Reabrindo…' : 'Reabrir visita'}
      </button>
    </div>
  )
}
