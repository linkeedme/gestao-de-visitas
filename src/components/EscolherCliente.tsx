'use client'
import { useState } from 'react'
import { erroDaResposta } from '@/lib/api/cliente'
import type { Contato } from '@/lib/zaple/tipos'

/**
 * Buscar e escolher um cliente do CRM.
 *
 * A busca é por toque, e não enquanto se digita: o vendedor faz isso no 4G da
 * rua, e uma chamada por letra digitada gasta a franquia dele e a cota da API
 * do CRM para responder buscas que ninguém chegou a ler.
 */
export function EscolherCliente({
  aoEscolher,
  aoCancelar,
}: {
  aoEscolher: (c: Contato) => void
  aoCancelar?: () => void
}) {
  const [busca, setBusca] = useState('')
  const [achados, setAchados] = useState<Contato[] | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function procurar(e: React.FormEvent) {
    e.preventDefault()
    if (busca.trim().length < 2) return
    setOcupado(true)
    setErro(null)
    try {
      const r = await fetch(`/api/contatos?busca=${encodeURIComponent(busca)}`)
      if (!r.ok) {
        setErro(await erroDaResposta(r, 'Não foi possível buscar clientes'))
        return
      }
      setAchados((await r.json()).contatos)
    } catch {
      setErro('Sem conexão. Verifique a internet.')
    } finally {
      setOcupado(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Formulário próprio para o Enter buscar em vez de salvar a visita —
          este bloco vive dentro do formulário de edição. */}
      <form onSubmit={procurar} className="flex gap-2">
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Nome ou telefone do cliente"
          autoFocus
          className="h-11 min-w-0 flex-1 rounded-xl bg-slate-50 px-3 ring-1 ring-slate-300"
        />
        <button
          type="submit"
          disabled={ocupado || busca.trim().length < 2}
          className="h-11 shrink-0 rounded-xl bg-asfalto px-4 font-semibold text-white disabled:opacity-50"
        >
          {ocupado ? '…' : 'Buscar'}
        </button>
      </form>

      {erro && (
        <p role="alert" className="text-sm font-medium text-red-700">
          {erro}
        </p>
      )}

      {achados?.length === 0 && (
        <p className="text-sm text-slate-500">Nenhum cliente encontrado com esse nome.</p>
      )}

      {achados && achados.length > 0 && (
        <ul className="flex max-h-64 flex-col gap-1 overflow-y-auto">
          {achados.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => aoEscolher(c)}
                className="flex w-full min-h-11 flex-col items-start rounded-xl px-3 py-2 text-left ring-1 ring-slate-200 transition-colors hover:bg-slate-50"
              >
                <span className="font-semibold">{c.nome}</span>
                {c.telefone && <span className="text-sm text-slate-500">{c.telefone}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}

      {aoCancelar && (
        <button
          type="button"
          onClick={aoCancelar}
          className="self-start text-sm font-medium text-slate-500 underline-offset-4 hover:underline"
        >
          Manter o cliente atual
        </button>
      )}
    </div>
  )
}
