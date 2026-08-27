'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Agente } from '@/lib/zaple/tipos'
import { erroDaResposta } from '@/lib/api/cliente'

export function FormUsuario({ agentes }: { agentes: Agente[] }) {
  const router = useRouter()
  const [papel, setPapel] = useState<'vendedor' | 'gestor'>('vendedor')
  const [zapleUserId, setZapleUserId] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formulario = e.currentTarget
    setEnviando(true)
    setErro(null)

    const dados = Object.fromEntries(new FormData(formulario))

    const r = await fetch('/api/usuarios', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        ...dados,
        email: dados.email || null,
        papel,
        // Vazio vira nulo: quem administra o sistema não é atendente no CRM
        // e não tem agente para escolher.
        zapleUserId: zapleUserId || null,
      }),
    })

    setEnviando(false)
    if (!r.ok) {
      setErro(await erroDaResposta(r, 'Não foi possível cadastrar'))
      return
    }
    formulario.reset()
    setZapleUserId('')
    setPapel('vendedor')
    router.refresh()
  }

  return (
    <form onSubmit={enviar} className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">Nome</span>
          <input
            name="nome"
            required
            className="rounded-xl border border-slate-300 px-3 py-2.5"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">Celular (é o login)</span>
          <input
            name="telefone"
            type="tel"
            inputMode="tel"
            required
            placeholder="(21) 99999-9999"
            className="rounded-xl border border-slate-300 px-3 py-2.5 placeholder:text-slate-400"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">E-mail (opcional)</span>
          <input
            name="email"
            type="email"
            className="rounded-xl border border-slate-300 px-3 py-2.5"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">Senha</span>
          <input
            name="senha"
            required
            minLength={8}
            type="password"
            placeholder="Mínimo 8 caracteres"
            className="rounded-xl border border-slate-300 px-3 py-2.5 placeholder:text-slate-400"
          />
        </label>
      </div>

      <fieldset>
        <legend className="mb-2 text-sm font-semibold">Papel</legend>
        <div className="flex gap-2">
          {(['vendedor', 'gestor'] as const).map((p) => (
            <label
              key={p}
              className={`flex-1 cursor-pointer rounded-xl px-3 py-2.5 text-center font-semibold capitalize ring-1 transition-colors ${
                papel === p ? 'bg-fazer/10 ring-fazer' : 'bg-white ring-slate-300'
              }`}
            >
              <input
                type="radio"
                name="papelEscolha"
                value={p}
                checked={papel === p}
                onChange={() => setPapel(p)}
                className="sr-only"
              />
              {p}
            </label>
          ))}
        </div>
      </fieldset>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold">
          Agente no CRM {papel === 'gestor' && <span className="font-normal text-slate-500">(opcional)</span>}
        </span>
        <select
          value={zapleUserId}
          onChange={(e) => setZapleUserId(e.target.value)}
          required={papel === 'vendedor'}
          className="rounded-xl border border-slate-300 bg-white px-3 py-2.5"
        >
          {/* Só o gestor pode ficar sem: o vendedor sem vínculo teria o kanban
              vazio para sempre, e o sintoma só apareceria dias depois, em campo. */}
          <option value="">
            {papel === 'gestor' ? 'Não é atendente no CRM' : 'Escolha o agente…'}
          </option>
          {/* value é o userId, não o id do agente: é o userId que os cards trazem. */}
          {agentes.map((a) => (
            <option key={a.userId} value={a.userId}>
              {a.nome}
            </option>
          ))}
        </select>
        <span className="text-sm text-slate-500">
          {papel === 'gestor'
            ? 'Sem vínculo, esta pessoa administra o sistema mas as visitas dela não vão para o CRM.'
            : 'É o vínculo que faz as visitas do vendedor aparecerem no CRM.'}
        </span>
      </label>

      {erro && (
        <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
          {erro}
        </p>
      )}

      <button
        disabled={enviando}
        className="rounded-xl bg-fazer px-4 py-3 font-semibold text-white disabled:opacity-50"
      >
        {enviando ? 'Cadastrando…' : `Cadastrar ${papel}`}
      </button>
    </form>
  )
}
