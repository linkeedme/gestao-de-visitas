# Gestão unificada — Fase 1

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fundir `/painel` e `/relatorios` numa única página de gestão cuja densidade muda com o tamanho da tela.

**Architecture:** A lógica que dá para testar sai dos componentes e vira função pura em `src/lib` — é o padrão do projeto, que não tem teste de render. `/painel` monta os cinco blocos; a auditoria fica em `<Suspense>` próprio e recolhida no celular por `<details>` nativo. `/relatorios` vira redirecionamento.

**Tech Stack:** Next.js 16.3 (App Router, Server Components), React 19, TypeScript strict, Tailwind 4, Vitest 4.

**Spec:** `docs/superpowers/specs/2026-08-27-gestao-unificada-e-agenda-mobile-design.md`

## Global Constraints

- Português correto com acentuação em toda a interface e nos comentários.
- O projeto **não tem teste de render**: só se testa lógica pura, em `tests/`. Não introduzir `@testing-library` nem qualquer dependência nova.
- Nenhum `<Link>` novo na navegação principal pode fazer prefetch automático (`prefetch={false}`), pela decisão de 2026-08-27.
- `clientesEmRisco` e `atrasadas` recebem **`hojeISO`**, nunca `ate`: atraso é pergunta sobre o presente.
- Alvo de toque mínimo de 44px em qualquer controle novo.
- Rodar `npx vitest run` e `npm run build` antes de cada commit.
- Commits em português, explicando o porquê, não o quê.

---

## Estrutura de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `src/lib/rotas.ts` *(criar)* | Montar o link da gestão preservando filtros |
| `src/lib/visita/alertas.ts` *(criar)* | Transformar as cinco listas de problema em itens de alerta |
| `src/app/(app)/painel/Alertas.tsx` *(criar)* | Desenhar o bloco "Precisa de atenção" |
| `src/app/(app)/painel/Auditoria.tsx` *(criar)* | Filtros, lista de visitas e exportação |
| `src/app/(app)/painel/page.tsx` *(modificar)* | Montar os cinco blocos |
| `src/app/(app)/painel/Graficos.tsx` *(modificar)* | `BarrasPorPessoa` passa a mostrar clientes alcançados |
| `src/app/(app)/relatorios/page.tsx` *(modificar)* | Redirecionar para `/painel` |
| `src/components/Navegacao.tsx` *(modificar)* | "Painel" e "Relatórios" viram "Gestão" |

**Ordem das tarefas:** a lógica pura primeiro, depois os componentes, e o corte de `/relatorios` por último — assim o aplicativo continua funcionando ao fim de cada tarefa.

---

### Task 1: Link da gestão

Hoje `/relatorios` monta seus links com uma função local `link()`. A página unificada precisa da mesma coisa, e o redirecionamento também. Uma função pura serve aos três e é a única parte testável disso.

**Files:**
- Create: `src/lib/rotas.ts`
- Test: `tests/rotas.test.ts`

**Interfaces:**
- Produces: `linkDaGestao(filtros: FiltrosGestao): string` e `type FiltrosGestao = { de: string; ate: string; vendedor?: string; status?: string }`

- [ ] **Step 1: Escrever o teste que falha**

```ts
import { describe, it, expect } from 'vitest'
import { linkDaGestao } from '@/lib/rotas'

describe('linkDaGestao', () => {
  it('leva sempre o intervalo', () => {
    expect(linkDaGestao({ de: '2026-08-01', ate: '2026-08-27' })).toBe(
      '/painel?de=2026-08-01&ate=2026-08-27'
    )
  })

  it('acrescenta vendedor e status quando existem', () => {
    expect(
      linkDaGestao({ de: '2026-08-01', ate: '2026-08-27', vendedor: 'u1', status: 'realizada' })
    ).toBe('/painel?de=2026-08-01&ate=2026-08-27&vendedor=u1&status=realizada')
  })

  it('omite filtro vazio — é assim que "limpar filtros" funciona', () => {
    expect(linkDaGestao({ de: '2026-08-01', ate: '2026-08-27', vendedor: '', status: '' })).toBe(
      '/painel?de=2026-08-01&ate=2026-08-27'
    )
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/rotas.test.ts`
Expected: FAIL — não existe `src/lib/rotas.ts`.

- [ ] **Step 3: Implementar**

```ts
export type FiltrosGestao = {
  de: string
  ate: string
  vendedor?: string
  status?: string
}

/**
 * O endereço da tela de gestão com os filtros que já estavam valendo.
 *
 * Cada controle da tela troca um filtro e precisa preservar os outros: mudar
 * o vendedor não pode devolver o gestor aos 30 dias padrão, e mudar a data
 * não pode apagar o status que ele acabou de escolher.
 *
 * String vazia apaga o filtro de propósito — é o que faz "limpar filtros"
 * ser um link como qualquer outro, sem JavaScript.
 */
export function linkDaGestao({ de, ate, vendedor, status }: FiltrosGestao): string {
  const p = new URLSearchParams({ de, ate })
  if (vendedor) p.set('vendedor', vendedor)
  if (status) p.set('status', status)
  return `/painel?${p}`
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run tests/rotas.test.ts`
Expected: PASS (3 testes).

- [ ] **Step 5: Commit**

```bash
git add src/lib/rotas.ts tests/rotas.test.ts
git commit -m "feat(rotas): endereço da gestão preservando os filtros em vigor"
```

---

### Task 2: Montagem dos alertas

Os cinco alertas hoje estão escritos à mão em dois arquivos, e dois deles aparecem nas duas páginas. Reduzir a uma lista de dados torna a duplicação impossível e o conteúdo testável.

**Files:**
- Create: `src/lib/visita/alertas.ts`
- Test: `tests/visita/alertas.test.ts`

**Interfaces:**
- Consumes: `LinhaRelatorio`, `ClienteEmRisco`, `CadeiaReagendamento` de `@/lib/visita/relatorios`; `Visita` de `@/lib/db`
- Produces: `montarAlertas(entradas: EntradasDeAlerta): Alerta[]`, `type Alerta = { chave: string; n: number; titulo: string; ajuda: string; tom: 'urgente' | 'atencao'; detalhe: string[] }`

- [ ] **Step 1: Escrever o teste que falha**

```ts
import { describe, it, expect } from 'vitest'
import { montarAlertas } from '@/lib/visita/alertas'

const vazio = { vencidas: [], empurrados: [], semRelato: [], emRisco: [], foraDoCrm: [] }

describe('montarAlertas', () => {
  it('não devolve alerta quando não há problema', () => {
    expect(montarAlertas(vazio)).toEqual([])
  })

  it('omite a categoria vazia — alerta zerado é ruído', () => {
    const r = montarAlertas({
      ...vazio,
      vencidas: [{ contatoNome: 'AUTOCAR', vendedor: 'Vitor', data: '2026-08-20' }] as never,
    })
    expect(r).toHaveLength(1)
    expect(r[0].chave).toBe('atrasadas')
  })

  it('põe o urgente antes do informativo', () => {
    const r = montarAlertas({
      ...vazio,
      emRisco: [{ contatoNome: 'CASA', diasSem: 45 }] as never,
      vencidas: [{ contatoNome: 'AUTOCAR', vendedor: 'Vitor', data: '2026-08-20' }] as never,
    })
    expect(r.map((a) => a.chave)).toEqual(['atrasadas', 'sem-visita'])
  })

  it('mostra no máximo três exemplos, mas conta todos', () => {
    const cinco = Array.from({ length: 5 }, (_, i) => ({
      contatoNome: `C${i}`,
      vendedor: 'Vitor',
      data: '2026-08-20',
    }))
    const [a] = montarAlertas({ ...vazio, vencidas: cinco as never })
    expect(a.n).toBe(5)
    expect(a.detalhe).toHaveLength(3)
  })

  it('usa singular quando é um só', () => {
    const [a] = montarAlertas({
      ...vazio,
      vencidas: [{ contatoNome: 'AUTOCAR', vendedor: 'Vitor', data: '2026-08-20' }] as never,
    })
    expect(a.titulo).toBe('visita atrasada')
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/visita/alertas.test.ts`
Expected: FAIL — não existe `src/lib/visita/alertas.ts`.

- [ ] **Step 3: Implementar**

```ts
import type { Visita } from '@/lib/db'
import { formatarDia } from './datas'
import type {
  CadeiaReagendamento,
  ClienteEmRisco,
  LinhaRelatorio,
} from './relatorios'

export type Alerta = {
  chave: string
  n: number
  titulo: string
  ajuda: string
  tom: 'urgente' | 'atencao'
  detalhe: string[]
}

export type EntradasDeAlerta = {
  vencidas: LinhaRelatorio[]
  empurrados: CadeiaReagendamento[]
  semRelato: LinhaRelatorio[]
  emRisco: ClienteEmRisco[]
  foraDoCrm: Visita[]
}

/** Três exemplos bastam para reconhecer o problema; o resto está na lista. */
const EXEMPLOS = 3

/**
 * As cinco perguntas que o gestor precisa responder, em ordem de urgência.
 *
 * Estavam escritas à mão em duas telas, e duas delas apareciam nas duas — o
 * mesmo aviso contado duas vezes. Como lista de dados, a duplicação deixa de
 * ser possível.
 *
 * Categoria vazia não vira alerta: um aviso que marca zero é ruído, e ruído
 * ensina o gestor a não olhar para o bloco inteiro.
 */
export function montarAlertas(e: EntradasDeAlerta): Alerta[] {
  const todos: Alerta[] = [
    {
      chave: 'atrasadas',
      n: e.vencidas.length,
      titulo: e.vencidas.length === 1 ? 'visita atrasada' : 'visitas atrasadas',
      ajuda: 'Data já passou e continuam a fazer.',
      tom: 'urgente',
      detalhe: e.vencidas
        .slice(0, EXEMPLOS)
        .map((v) => `${v.contatoNome} · ${v.vendedor} · ${formatarDia(v.data)}`),
    },
    {
      chave: 'empurrados',
      n: e.empurrados.length,
      titulo:
        e.empurrados.length === 1
          ? 'cliente reagendado em série'
          : 'clientes reagendados em série',
      ajuda: 'Empurrados duas vezes ou mais. É o negócio que morre sem ninguém perceber.',
      tom: 'urgente',
      detalhe: e.empurrados
        .slice(0, EXEMPLOS)
        .map((c) => `${c.contatoNome} · ${c.vezes}× · ${c.vendedor}`),
    },
    {
      chave: 'sem-relato',
      n: e.semRelato.length,
      titulo: e.semRelato.length === 1 ? 'realizada sem relato' : 'realizadas sem relato',
      ajuda: 'Marcadas como feitas sem registro do que foi tratado — não dá para auditar.',
      tom: 'atencao',
      detalhe: e.semRelato
        .slice(0, EXEMPLOS)
        .map((v) => `${v.contatoNome} · ${v.vendedor} · ${formatarDia(v.data)}`),
    },
    {
      chave: 'sem-visita',
      n: e.emRisco.length,
      titulo: e.emRisco.length === 1 ? 'cliente sem visita' : 'clientes sem visita',
      ajuda: 'Mais de 30 dias desde a última visita realizada.',
      tom: 'atencao',
      detalhe: e.emRisco.slice(0, EXEMPLOS).map((c) => `${c.contatoNome} · ${c.diasSem} dias`),
    },
    {
      chave: 'fora-do-crm',
      n: e.foraDoCrm.length,
      titulo: e.foraDoCrm.length === 1 ? 'visita fora do CRM' : 'visitas fora do CRM',
      ajuda: 'Deveriam ter virado card no Zaple e não viraram.',
      tom: 'atencao',
      detalhe: e.foraDoCrm
        .slice(0, EXEMPLOS)
        .map((v) => `${v.contatoNome} · ${formatarDia(v.data)}`),
    },
  ]

  return todos.filter((a) => a.n > 0)
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run tests/visita/alertas.test.ts`
Expected: PASS (5 testes).

- [ ] **Step 5: Commit**

```bash
git add src/lib/visita/alertas.ts tests/visita/alertas.test.ts
git commit -m "feat(alertas): os cinco avisos viram dados, e param de existir em duplicata"
```

---

### Task 3: Clientes alcançados em "Por pessoa"

`resumoPorVendedor` (gráfico do painel) e `kpisPorVendedor` (cartões dos relatórios) respondem a mesma pergunta. `kpisPorVendedor` devolve tudo o que a outra devolve e mais `clientesAlcancados` — então ela é a que fica, e o gráfico ganha o número que faltava.

**Files:**
- Modify: `src/app/(app)/painel/Graficos.tsx` — `BarrasPorPessoa`

**Interfaces:**
- Consumes: `KpiVendedor` de `@/lib/visita/relatorios`
- Produces: `BarrasPorPessoa({ linhas }: { linhas: KpiVendedor[] })`

- [ ] **Step 1: Trocar o tipo da propriedade**

Em `BarrasPorPessoa`, substituir a assinatura atual por:

```tsx
export function BarrasPorPessoa({ linhas }: { linhas: KpiVendedor[] }) {
  const maximo = Math.max(
    1,
    ...linhas.map((l) => l.realizadas + l.aFazer + l.reagendadas + l.canceladas)
  )
```

E acrescentar no topo do arquivo:

```tsx
import type { KpiVendedor } from '@/lib/visita/relatorios'
```

Trocar `key={l.id}` por `key={l.usuarioId}` e `{l.nome}` por `{l.vendedor}`.

- [ ] **Step 2: Mostrar o alcance ao lado do volume**

Substituir o cabeçalho de cada linha por:

```tsx
<div className="flex items-baseline justify-between gap-2">
  <span className="truncate text-sm font-semibold">{l.vendedor}</span>
  <span className="shrink-0 text-xs text-slate-500">
    <span className="font-display text-sm font-semibold text-slate-700">{soma}</span> visitas ·{' '}
    {l.clientesAlcancados} {l.clientesAlcancados === 1 ? 'cliente' : 'clientes'}
  </span>
</div>
```

O alcance responde o que o volume esconde: dez visitas em dois clientes não é o mesmo trabalho que dez visitas em dez.

- [ ] **Step 3: Verificar que compila**

Run: `npm run build`
Expected: sucesso. Erro de tipo em `painel/page.tsx` é esperado nesta etapa — a página ainda passa `resumoPorVendedor`; a Task 5 corrige. Se o build falhar **apenas** por isso, seguir.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(app)/painel/Graficos.tsx"
git commit -m "feat(painel): por pessoa passa a mostrar alcance, não só volume"
```

---

### Task 4: Blocos de alerta e de auditoria

**Files:**
- Create: `src/app/(app)/painel/Alertas.tsx`
- Create: `src/app/(app)/painel/Auditoria.tsx`

**Interfaces:**
- Consumes: `Alerta` de `@/lib/visita/alertas`; `linkDaGestao` de `@/lib/rotas`; `LinhaRelatorio` de `@/lib/visita/relatorios`
- Produces: `Alertas({ alertas }: { alertas: Alerta[] })` e `Auditoria({ visitas, vendedores, filtros }: PropsAuditoria)`

- [ ] **Step 1: Escrever `Alertas.tsx`**

```tsx
import type { Alerta } from '@/lib/visita/alertas'

/**
 * O bloco que pede ação, e por isso vem antes dos gráficos.
 *
 * Gráfico é contexto; alerta é trabalho. Estavam depois dos gráficos nas duas
 * telas antigas — o urgente atrás do ilustrativo.
 *
 * O tom só reforça o que o texto já diz: cor sozinha não informa ninguém que
 * não enxerga a diferença.
 */
export function Alertas({ alertas }: { alertas: Alerta[] }) {
  if (alertas.length === 0) return null

  return (
    <section className="flex flex-col gap-2">
      <h2 className="px-1 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
        Precisa de atenção
      </h2>
      <div className="grid gap-2 lg:grid-cols-2">
        {alertas.map((a) => (
          <div
            key={a.chave}
            className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200/70"
          >
            <p className="flex items-baseline gap-2">
              <span
                className={`font-display text-2xl font-semibold ${
                  a.tom === 'urgente' ? 'text-adiada' : 'text-slate-500'
                }`}
              >
                {a.n}
              </span>
              <span className="font-semibold">{a.titulo}</span>
            </p>
            <p className="mt-0.5 text-sm text-slate-500">{a.ajuda}</p>
            <ul className="mt-2 border-t border-slate-100 pt-2 text-sm text-slate-600">
              {a.detalhe.map((d) => (
                <li key={d} className="truncate">
                  {d}
                </li>
              ))}
              {a.n > a.detalhe.length && (
                <li className="text-slate-400">e mais {a.n - a.detalhe.length}</li>
              )}
            </ul>
          </div>
        ))}
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Escrever `Auditoria.tsx`**

Mover para cá, sem alterar comportamento, o que hoje vive no fim de `relatorios/page.tsx`: os dois conjuntos de filtro, o link de limpar, o botão de planilha e a lista de visitas. O que muda é a embalagem: `<details>` em vez de `<section>`, e `linkDaGestao` no lugar da função local.

```tsx
import Link from 'next/link'
import { linkDaGestao } from '@/lib/rotas'
import { formatarDia } from '@/lib/visita/datas'
import { rotuloDoTipo } from '@/lib/visita/tipos'
import type { LinhaRelatorio } from '@/lib/visita/relatorios'

const STATUS: Record<string, { rotulo: string; cor: string; faixa: string }> = {
  a_fazer: { rotulo: 'A fazer', cor: 'text-fazer', faixa: 'bg-fazer' },
  realizada: { rotulo: 'Realizada', cor: 'text-feita', faixa: 'bg-feita' },
  reagendada: { rotulo: 'Reagendada', cor: 'text-adiada', faixa: 'bg-adiada' },
  cancelada: { rotulo: 'Cancelada', cor: 'text-slate-400', faixa: 'bg-morta' },
}

type PropsAuditoria = {
  visitas: LinhaRelatorio[]
  vendedores: { id: string; nome: string }[]
  filtros: { de: string; ate: string; vendedor?: string; status?: string }
}

/**
 * A auditoria, recolhida no celular e aberta no notebook.
 *
 * O gestor declarou fazer duas coisas em dois aparelhos: de manhã confere
 * pelo celular, na reunião audita pelo notebook. Este é o único bloco que o
 * celular esconde, e é justamente o que ele não usa por lá.
 *
 * `<details>` nativo em vez de estado no cliente: decidir por largura de tela
 * no navegador produziria o salto no primeiro render que a navegação evita de
 * propósito. No notebook o CSS abre o conteúdo e esconde o resumo.
 */
export function Auditoria({ visitas, vendedores, filtros }: PropsAuditoria) {
  const { vendedor, status } = filtros
  const link = (troca: { vendedor?: string; status?: string }) =>
    linkDaGestao({ ...filtros, ...troca })

  return (
    <details className="group [&>*:not(summary)]:lg:block" open>
      <summary className="cursor-pointer list-none rounded-2xl bg-white px-4 py-3 font-semibold shadow-sm ring-1 ring-slate-200/70 lg:hidden">
        Ver visitas do período ({visitas.length})
      </summary>

      <section className="mt-2 flex flex-col gap-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2 px-1">
          <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
            Visitas ({visitas.length})
          </h2>
          {(vendedor || status) && (
            <Link
              href={link({ vendedor: '', status: '' })}
              prefetch={false}
              className="text-sm font-semibold text-fazer underline-offset-4 hover:underline"
            >
              limpar filtros
            </Link>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5">
          <Filtro href={link({ vendedor: '' })} ativo={!vendedor} rotulo="Todos" />
          {vendedores.map((v) => (
            <Filtro
              key={v.id}
              href={link({ vendedor: v.id })}
              ativo={vendedor === v.id}
              rotulo={v.nome.split(' ')[0]}
            />
          ))}
        </div>

        <div className="flex flex-wrap gap-1.5">
          <Filtro href={link({ status: '' })} ativo={!status} rotulo="Todos os status" />
          {Object.entries(STATUS).map(([chave, s]) => (
            <Filtro
              key={chave}
              href={link({ status: chave })}
              ativo={status === chave}
              rotulo={s.rotulo}
            />
          ))}
        </div>

        <a
          href={`/api/relatorios/csv?de=${filtros.de}&ate=${filtros.ate}${vendedor ? `&usuarioId=${vendedor}` : ''}${status ? `&status=${status}` : ''}`}
          className="flex items-center justify-center gap-2 rounded-xl bg-asfalto px-4 py-3 font-semibold text-white"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
            <path d="M12 3v12M7 12l5 5 5-5M5 21h14" />
          </svg>
          Baixar planilha do período
        </a>

        {visitas.length === 0 && (
          <p className="rounded-2xl border border-dashed border-slate-300 px-5 py-6 text-center text-sm text-slate-500">
            Nenhuma visita com esses filtros.
          </p>
        )}

        <div className="grid gap-2 lg:grid-cols-2">
          {visitas.map((v) => {
            const s = STATUS[v.status]
            return (
              <Link
                key={v.id}
                href={`/visita/${v.id}`}
                prefetch={false}
                className="flex overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/70"
              >
                <div className={`w-1.5 shrink-0 ${s.faixa}`} aria-hidden="true" />
                <div className="min-w-0 flex-1 p-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <h3 className="truncate font-display font-semibold">{v.contatoNome}</h3>
                    <span className={`text-xs font-bold uppercase tracking-wide ${s.cor}`}>
                      {s.rotulo}
                    </span>
                  </div>
                  <p className="text-sm text-slate-500">
                    {formatarDia(v.data)} · {v.vendedor} · {rotuloDoTipo(v.tipo)}
                  </p>
                  {v.relatorio ? (
                    <p className="mt-2 line-clamp-3 border-t border-slate-100 pt-2 text-sm text-slate-600">
                      {v.relatorio}
                    </p>
                  ) : v.status === 'realizada' ? (
                    <p className="mt-2 border-t border-slate-100 pt-2 text-sm text-adiada">
                      Realizada sem relato do que foi tratado.
                    </p>
                  ) : null}
                </div>
              </Link>
            )
          })}
        </div>
      </section>
    </details>
  )
}

function Filtro({ href, ativo, rotulo }: { href: string; ativo: boolean; rotulo: string }) {
  return (
    <Link
      href={href}
      prefetch={false}
      className={`rounded-full px-3.5 py-2 text-sm font-semibold transition-colors ${
        ativo ? 'bg-asfalto text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200'
      }`}
    >
      {rotulo}
    </Link>
  )
}
```

- [ ] **Step 3: Verificar que compila**

Run: `npm run build`
Expected: sucesso, salvo o erro já conhecido em `painel/page.tsx`, corrigido na Task 5.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(app)/painel/Alertas.tsx" "src/app/(app)/painel/Auditoria.tsx"
git commit -m "feat(gestão): blocos de alerta e de auditoria, com a lista recolhida no celular"
```

---

### Task 5: A página de gestão

**Files:**
- Modify: `src/app/(app)/painel/page.tsx`

**Interfaces:**
- Consumes: `montarAlertas`, `linkDaGestao`, `Alertas`, `Auditoria`, `BarrasPorDia`, `BarrasPorPessoa`, `PorTipo`, `Legenda`, `intervaloDoFiltro`, `ATALHOS`

- [ ] **Step 1: Trocar o filtro de período pelo compartilhado**

Apagar a constante local `PERIODOS` e a aritmética de `?periodo=`. Usar o mesmo filtro dos relatórios, que aceita range livre **e** continua entendendo o `?periodo=` antigo — os links já salvos do painel seguem funcionando:

```tsx
const { de: deParam, ate: ateParam, periodo, vendedor, status } = await searchParams
const texto = (v: unknown) => (typeof v === 'string' && v ? v : undefined)
const hojeISO = hoje()
const { de, ate, atalhoAtivo } = intervaloDoFiltro(
  { de: texto(deParam), ate: texto(ateParam), periodo: texto(periodo) },
  hojeISO
)
const usuarioId = texto(vendedor)
const statusFiltro =
  typeof status === 'string' && ['a_fazer', 'realizada', 'cancelada', 'reagendada'].includes(status)
    ? (status as 'a_fazer' | 'realizada' | 'cancelada' | 'reagendada')
    : undefined
```

- [ ] **Step 2: Buscar os dados dos quatro primeiros blocos**

```tsx
const [kpis, foraDoCrm, adiante, serie, tipos, emRisco, empurrados, semRelato, vencidas] =
  await Promise.all([
    kpisPorVendedor(db, de, ate),
    listarNaoSincronizadas(db),
    contarAgendadasAdiante(db, ate),
    serieDiaria(db, de, ate),
    porTipo(db, de, ate),
    // `hojeISO`, não `ate`: atraso é pergunta sobre o presente. Com range
    // livre, passar `ate` faria a tela de julho responder o que estava
    // atrasado em julho, e o gestor leria como situação de agora.
    clientesEmRisco(db, hojeISO, 30),
    reagendamentosEmSerie(db, de, ate),
    realizadasSemRelato(db, de, ate),
    atrasadas(db, hojeISO),
  ])

const alertas = montarAlertas({ vencidas, empurrados, semRelato, emRisco, foraDoCrm })

const total = kpis.reduce(
  (acc, l) => ({
    aFazer: acc.aFazer + l.aFazer,
    realizadas: acc.realizadas + l.realizadas,
    canceladas: acc.canceladas + l.canceladas,
    reagendadas: acc.reagendadas + l.reagendadas,
  }),
  { aFazer: 0, realizadas: 0, canceladas: 0, reagendadas: 0 }
)
const fechadas = total.realizadas + total.canceladas
const conclusao = fechadas === 0 ? 0 : Math.round((total.realizadas / fechadas) * 100)
const emCampo = serie.filter((d) => d.realizadas > 0).length
const mediaDia = emCampo === 0 ? 0 : total.realizadas / emCampo
```

- [ ] **Step 3: Montar a página na ordem da spec**

Título "Gestão", atalhos de período usando `linkDaGestao`, e os blocos nesta ordem: números, `<Alertas>`, movimento, por pessoa, auditoria. A auditoria fica dentro de `<Suspense>` com o esqueleto como fallback:

```tsx
<Suspense fallback={<EsqueletoAuditoria />}>
  <BlocoAuditoria filtros={{ de, ate, vendedor: usuarioId, status: statusFiltro }} />
</Suspense>
```

Com o componente assíncrono no mesmo arquivo, para que suas duas consultas não segurem o resto da página:

```tsx
async function BlocoAuditoria({ filtros }: { filtros: FiltrosGestao }) {
  const [visitas, vendedores] = await Promise.all([
    listarParaAuditoria(db, {
      de: filtros.de,
      ate: filtros.ate,
      usuarioId: filtros.vendedor,
      status: filtros.status as 'a_fazer' | 'realizada' | 'cancelada' | 'reagendada' | undefined,
    }),
    vendedoresComVisita(db, filtros.de, filtros.ate),
  ])
  return <Auditoria visitas={visitas} vendedores={vendedores} filtros={filtros} />
}

function EsqueletoAuditoria() {
  return (
    <div className="h-32 animate-pulse rounded-2xl bg-white ring-1 ring-slate-200/70 motion-reduce:animate-none" />
  )
}
```

Trocar `<BarrasPorPessoa linhas={linhas} />` por `<BarrasPorPessoa linhas={kpis} />`.

- [ ] **Step 4: Rodar tudo**

Run: `npx vitest run && npm run build`
Expected: todos os testes passam e o build conclui.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(app)/painel/page.tsx"
git commit -m "feat(gestão): uma página só, do número ao detalhe"
```

---

### Task 6: Aposentar `/relatorios`

Última tarefa de propósito: até aqui o aplicativo funcionou a cada passo, com as duas rotas no ar.

**Files:**
- Modify: `src/app/(app)/relatorios/page.tsx`
- Modify: `src/components/Navegacao.tsx`

- [ ] **Step 1: Transformar a página em redirecionamento**

Apagar todo o conteúdo de `relatorios/page.tsx` e deixar:

```tsx
import { redirect } from 'next/navigation'
import { linkDaGestao } from '@/lib/rotas'
import { hoje, somarDias } from '@/lib/visita/datas'

export const dynamic = 'force-dynamic'

/**
 * Relatórios virou parte da gestão.
 *
 * O redirecionamento preserva os filtros porque quem tem esta URL salva a
 * salvou com eles: um link mandado no grupo do time, um favorito de reunião.
 * Chegar na tela certa com o filtro perdido é quase tão ruim quanto o 404.
 */
export default async function Relatorios({ searchParams }: PageProps<'/relatorios'>) {
  const { de, ate, periodo, vendedor, status } = await searchParams
  const texto = (v: unknown) => (typeof v === 'string' && v ? v : undefined)
  const hojeISO = hoje()

  redirect(
    linkDaGestao({
      de: texto(de) ?? somarDias(hojeISO, -29),
      ate: texto(ate) ?? hojeISO,
      vendedor: texto(vendedor),
      status: texto(status),
    }) + (texto(periodo) ? `&periodo=${texto(periodo)}` : '')
  )
}
```

- [ ] **Step 2: Fundir os dois itens da navegação**

Em `montarItens`, apagar o item `/relatorios` e renomear o de `/painel`:

```tsx
{
  href: '/painel',
  rotulo: 'Gestão',
  icone: (
    <Icone>
      <path d="M3 20h18" />
      <rect x="5" y="12" width="3.5" height="8" rx="1" />
      <rect x="10.25" y="7" width="3.5" height="13" rx="1" />
      <rect x="15.5" y="15" width="3.5" height="5" rx="1" />
    </Icone>
  ),
},
```

A barra do celular passa de cinco itens para quatro.

- [ ] **Step 3: Conferir que nada mais aponta para a rota antiga**

Run: `grep -rn "/relatorios" src/ --include=*.tsx --include=*.ts | grep -v "api/relatorios" | grep -v "relatorios/page.tsx"`
Expected: nenhuma linha. Achando alguma, apontar para `/painel`. Atenção: `/api/relatorios/csv` **fica**, é outra coisa.

- [ ] **Step 4: Rodar tudo**

Run: `npx vitest run && npm run build`
Expected: todos passam; o build não lista mais `/relatorios` como página com conteúdo.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(app)/relatorios/page.tsx" src/components/Navegacao.tsx
git commit -m "feat(navegação): painel e relatórios viram Gestão, com a rota antiga preservada"
```

---

## Autorrevisão

**Cobertura da spec.** Ordem dos cinco blocos (Task 5); densidade por tela (Tasks 4 e 5); `<details>` nativo (Task 4); `<Suspense>` na auditoria (Task 5); onze consultas (Task 5); `/relatorios` redirecionando com parâmetros (Task 6); navegação virando "Gestão" (Task 6); alerta único por categoria (Task 2); alcance em "por pessoa" (Task 3).

**Casos de borda.** Período sem visita: `montarAlertas` devolve lista vazia e `Alertas` não renderiza nada; os gráficos já têm estado vazio. Mês fora do período e falha de banco pertencem à Fase 2 e ao `error.tsx` existente.

**Consistência de tipos.** `linkDaGestao` e `FiltrosGestao` (Task 1) são usados nas Tasks 4, 5 e 6 com o mesmo formato. `BarrasPorPessoa` passa a receber `KpiVendedor[]` na Task 3 e é assim que a Task 5 a chama — `usuarioId` e `vendedor`, não `id` e `nome`.

**Testes.** Só de lógica pura, como o projeto faz: `linkDaGestao` (3) e `montarAlertas` (5). Componente não tem teste porque o projeto não tem infraestrutura para isso, e criá-la é escopo que ninguém pediu.

## Fora do escopo

- Redesenho da agenda no celular — Fase 2, plano próprio.
- Remover `resumoPorVendedor`, que fica sem uso.
- Cache das consultas de gestão.
