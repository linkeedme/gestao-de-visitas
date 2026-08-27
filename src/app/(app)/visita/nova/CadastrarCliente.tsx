'use client'
import { useEffect, useState } from 'react'
import { erroDaResposta } from '@/lib/api/cliente'
import type { Contato } from '@/lib/zaple/tipos'

type Campo = { id: string; nome: string; chave: string | null; opcoes: string[] }

/**
 * Cadastrar o cliente sem sair da tela de agendar visita.
 *
 * Prospecção acontece na rua: o vendedor conhece alguém, quer marcar a visita
 * e o contato não existe no CRM. Mandá-lo abrir o Zaple, cadastrar e voltar
 * significa, na prática, que a visita não é agendada — e o cliente novo se
 * perde num caderno.
 *
 * Só nome e telefone são exigidos. O resto da ficha fica aberto para quem
 * souber, porque quem acabou de conhecer o cliente raramente tem o CNPJ dele.
 */
export function CadastrarCliente({
  nomeSugerido,
  ocupado,
  onCadastrado,
  onCancelar,
  onErro,
}: {
  nomeSugerido: string
  ocupado: boolean
  onCadastrado: (c: Contato) => void
  onCancelar: () => void
  onErro: (mensagem: string) => void
}) {
  const [nome, setNome] = useState(nomeSugerido)
  const [telefone, setTelefone] = useState('')
  const [campos, setCampos] = useState<Campo[]>([])
  const [valores, setValores] = useState<Record<string, string>>({})
  const [fichaAberta, setFichaAberta] = useState(false)
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    // Os campos vêm do CRM, não daqui: quando a operação criar um campo novo
    // lá, ele aparece nesta tela sozinho.
    fetch('/api/contatos/campos')
      .then((r) => (r.ok ? r.json() : { campos: [] }))
      .then((d) => setCampos(d.campos ?? []))
      .catch(() => setCampos([]))
  }, [])

  const telefoneValido = telefone.replace(/\D/g, '').length >= 10
  const preenchidos = Object.values(valores).filter((v) => v.trim()).length

  async function cadastrar() {
    setEnviando(true)
    try {
      const porChave: Record<string, string> = {}
      for (const c of campos) {
        const v = valores[c.id]?.trim()
        // A API indexa por CHAVE, não por id. Campo sem chave não tem como
        // ser gravado, então nem é oferecido.
        if (v && c.chave) porChave[c.chave] = v
      }

      const r = await fetch('/api/contatos', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          nome: nome.trim(),
          telefone,
          ...(Object.keys(porChave).length ? { camposPersonalizados: porChave } : {}),
        }),
      })

      if (!r.ok) {
        onErro(await erroDaResposta(r, 'Não foi possível cadastrar o cliente'))
        return
      }
      onCadastrado((await r.json()).contato)
    } catch {
      onErro('Sem conexão. O cliente não foi cadastrado.')
    } finally {
      setEnviando(false)
    }
  }

  const trabalhando = ocupado || enviando

  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-white p-4 ring-1 ring-slate-200">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
          Cliente novo
        </p>
        <button
          type="button"
          onClick={onCancelar}
          className="text-sm font-medium text-slate-500 underline-offset-4 hover:underline"
        >
          Cancelar
        </button>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold">Nome</span>
        <input
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          className="rounded-xl border border-slate-300 px-3 py-2.5"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold">Celular</span>
        <input
          type="tel"
          inputMode="tel"
          value={telefone}
          onChange={(e) => setTelefone(e.target.value)}
          placeholder="(21) 99999-9999"
          className="rounded-xl border border-slate-300 px-3 py-2.5 placeholder:text-slate-400"
        />
      </label>

      {campos.length > 0 && (
        <div className="rounded-xl bg-slate-50 p-3">
          <button
            type="button"
            onClick={() => setFichaAberta(!fichaAberta)}
            className="flex w-full items-center justify-between text-left"
          >
            <span className="text-sm font-semibold">
              Ficha do cliente
              <span className="ml-1.5 font-normal text-slate-500">
                {preenchidos > 0 ? `· ${preenchidos} preenchido${preenchidos > 1 ? 's' : ''}` : '· opcional'}
              </span>
            </span>
            <span className="text-slate-400" aria-hidden="true">
              {fichaAberta ? '−' : '+'}
            </span>
          </button>

          {fichaAberta && (
            <div className="mt-3 flex flex-col gap-3">
              <p className="text-sm text-slate-500">
                Preencha o que souber. Nada aqui é obrigatório — dá para completar
                depois, no CRM.
              </p>
              {campos.map((c) => (
                <label key={c.id} className="flex flex-col gap-1">
                  <span className="text-sm text-slate-600">{c.nome}</span>
                  {c.opcoes.length > 0 ? (
                    <select
                      value={valores[c.id] ?? ''}
                      onChange={(e) => setValores({ ...valores, [c.id]: e.target.value })}
                      className="rounded-xl border border-slate-300 bg-white px-3 py-2.5"
                    >
                      <option value="">—</option>
                      {c.opcoes.map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      value={valores[c.id] ?? ''}
                      onChange={(e) => setValores({ ...valores, [c.id]: e.target.value })}
                      className="rounded-xl border border-slate-300 px-3 py-2.5"
                    />
                  )}
                </label>
              ))}
            </div>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={cadastrar}
        disabled={trabalhando || !nome.trim() || !telefoneValido}
        className="rounded-xl bg-fazer px-4 py-3 font-semibold text-white disabled:opacity-40"
      >
        {trabalhando ? 'Cadastrando…' : 'Cadastrar e usar nesta visita'}
      </button>

      {!telefoneValido && telefone.length > 0 && (
        <p className="text-center text-sm text-slate-500">
          O celular precisa ter DDD e número completos.
        </p>
      )}
    </div>
  )
}
