'use client'

/**
 * O que a pessoa vê quando o banco não responde.
 *
 * Sem este arquivo, uma falha de leitura devolvia tela em branco — e a tela em
 * branco não diz se o problema é o telefone, a internet do cliente ou o
 * sistema. O vendedor está na porta da loja: ou ele sabe que pode tentar de
 * novo, ou desiste de registrar a visita.
 *
 * Fica na raiz de propósito. O layout do app lê a sessão no banco, então uma
 * queda derruba o próprio layout — um error.tsx dentro de (app) não seria
 * alcançado.
 */
export default function Erro({ retry }: { error: Error; retry: () => void }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="font-display text-xl font-semibold">Não foi possível carregar</h1>
      <p className="max-w-xs text-slate-500">
        O sistema não respondeu agora. Suas visitas estão salvas — tente de novo.
      </p>
      <button
        type="button"
        onClick={retry}
        className="rounded-xl bg-fazer px-5 py-3 font-semibold text-white"
      >
        Tentar de novo
      </button>
    </main>
  )
}
