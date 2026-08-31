import { exigirGestor } from '@/lib/auth/atual'
import { listarUsuarios } from '@/lib/auth/usuarios'
import { comTeto } from '@/lib/teto'
import { TETO_DA_TELA_S } from '@/lib/prazos'
import { listarAgentes } from '@/lib/zaple/agentes'
import { listarNaoSincronizadas, db } from '@/lib/visita/repositorio'
import { FormUsuario } from './FormUsuario'
import { Pendentes } from './Pendentes'
import { CardUsuario } from './CardUsuario'

export const dynamic = 'force-dynamic'

export default async function Admin() {
  const eu = await exigirGestor()
  const [usuarios, agentes, pendentes] = await comTeto('admin:consultas', TETO_DA_TELA_S, () => Promise.all([
    listarUsuarios(),
    listarAgentes(),
    listarNaoSincronizadas(db),
  ]))

  const vendedores = usuarios.filter((u) => u.papel === 'vendedor')
  const gestores = usuarios.filter((u) => u.papel === 'gestor')

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-display text-2xl font-semibold">Equipe</h1>
        <p className="text-sm text-slate-500">
          {vendedores.length} {vendedores.length === 1 ? 'vendedor' : 'vendedores'} ·{' '}
          {gestores.length} {gestores.length === 1 ? 'gestor' : 'gestores'}
        </p>
      </div>

      <Pendentes quantidade={pendentes.length} />

      <section className="flex flex-col gap-2">
        <h2 className="px-1 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
          Vendedores
        </h2>
        {vendedores.length === 0 && (
          <p className="rounded-2xl border border-dashed border-slate-300 px-5 py-6 text-center text-sm text-slate-500">
            Nenhum vendedor cadastrado. Só vendedores aparecem no painel.
          </p>
        )}
        <div className="grid gap-2 lg:grid-cols-2">
          {vendedores.map((u) => (
            <CardUsuario key={u.id} usuario={u} agentes={agentes} souEu={u.id === eu.id} />
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="px-1 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
          Gestores
        </h2>
        <p className="px-1 text-sm text-slate-500">
          Enxergam o painel e as visitas de todo mundo. As visitas que eles fazem não contam
          nas métricas de vendedor.
        </p>
        <div className="grid gap-2 lg:grid-cols-2">
          {gestores.map((u) => (
            <CardUsuario key={u.id} usuario={u} agentes={agentes} souEu={u.id === eu.id} />
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="px-1 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
          Cadastrar pessoa
        </h2>
        <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200/70">
          <FormUsuario agentes={agentes} />
        </div>
      </section>
    </div>
  )
}
