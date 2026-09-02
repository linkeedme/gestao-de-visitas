'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { erroDaResposta } from '@/lib/api/cliente'
import type { Visita } from '@/lib/db'

/**
 * Apagar a visita, de vez.
 *
 * Cancelar já existe e serve para a visita que não vai acontecer — ela
 * continua no relatório, porque um cancelamento é informação sobre a
 * operação. Apagar serve para a que nunca deveria ter sido criada: o toque
 * errado no bolso, a duplicada, a lançada na ficha de outro cliente.
 *
 * Fica no fim da tela, fora do bloco de edição, e pede confirmação no lugar —
 * sem `confirm()` do navegador, que no celular aparece colado no topo, longe
 * do polegar, e não deixa dizer o que exatamente vai acontecer.
 */
export function ApagarVisita({ visita }: { visita: Visita }) {
  const router = useRouter()
  const [confirmando, setConfirmando] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function apagar() {
    setOcupado(true)
    setErro(null)
    try {
      const r = await fetch(`/api/visitas/${visita.id}`, { method: 'DELETE' })
      if (!r.ok) {
        setErro(await erroDaResposta(r, 'Não foi possível apagar'))
        return
      }

      // A tela de destino é a agenda: a visita que estava aqui não existe
      // mais, e voltar para ela mostraria um 404.
      router.replace('/agenda')
      router.refresh()
    } catch {
      setErro('Sem conexão. A visita não foi apagada.')
    } finally {
      setOcupado(false)
    }
  }

  if (!confirmando) {
    return (
      <button
        onClick={() => setConfirmando(true)}
        className="self-start rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-500 underline-offset-4 transition-colors hover:text-red-700 hover:underline"
      >
        Apagar esta visita
      </button>
    )
  }

  return (
    <section className="flex flex-col gap-3 rounded-2xl bg-red-50 p-4 ring-1 ring-red-200">
      <div>
        <h2 className="font-display font-semibold text-red-900">Apagar esta visita?</h2>
        <p className="mt-1 text-sm text-red-800">
          Ela sai daqui e o card sai do CRM. Não dá para desfazer — se a visita não vai
          acontecer, cancelar mantém o registro e conta a história certa no relatório.
        </p>
      </div>

      {erro && (
        <p role="alert" className="text-sm font-medium text-red-700">
          {erro}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          onClick={apagar}
          disabled={ocupado}
          className="min-h-11 rounded-xl bg-red-700 px-4 font-semibold text-white disabled:opacity-50"
        >
          {ocupado ? 'Apagando…' : 'Sim, apagar'}
        </button>
        <button
          onClick={() => setConfirmando(false)}
          disabled={ocupado}
          className="min-h-11 rounded-xl px-4 font-semibold text-slate-600"
        >
          Manter
        </button>
      </div>
    </section>
  )
}
