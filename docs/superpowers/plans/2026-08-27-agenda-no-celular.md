# Agenda no celular — Fase 2

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fazer as três visões da agenda funcionarem no celular, onde o vendedor realmente as usa.

**Architecture:** A escala de carga vira função pura testável em `src/lib`. O mês troca pontinhos por intensidade de fundo; a semana ganha uma faixa de dias no celular e mantém a grade no notebook; a lista do dia ganha hierarquia e alvo de toque.

**Tech Stack:** Next.js 16.3 (App Router, Server Components), React 19, TypeScript strict, Tailwind 4, Vitest 4.

**Spec:** `docs/superpowers/specs/2026-08-27-gestao-unificada-e-agenda-mobile-design.md`

## Global Constraints

- Português correto com acentuação na interface e nos comentários.
- Sem teste de render: só lógica pura, em `tests/`. Nenhuma dependência nova.
- Alvo de toque mínimo de 44px.
- Cor nunca sozinha: toda carga codificada por cor traz número visível e `aria-label`.
- Escala sequencial de um matiz só — nunca arco-íris.
- Estado de navegação vive na URL (`data`, `vista`), nunca no cliente.
- `npx vitest run` e `npm run build` antes de cada commit.

---

## O que está errado hoje

**Mês.** A célula tem 80px de altura, o que é adequado — o problema não é o alvo de toque. É que a carga do dia é desenhada como até seis pontinhos de 6px por status, quatro status, numa célula de cerca de 48px de largura: até vinte e quatro bolinhas empilhando por `flex-wrap`. A distinção entre elas é só a cor, e o `title` que explicaria não existe no toque.

**Semana.** No celular a grade some (`lg:hidden`) e os sete dias viram sete seções empilhadas, cada uma com todos os seus cartões. Uma semana movimentada vira um scroll de vários metros, e a noção de semana se perde no caminho.

**Todas.** Cada visão desenha seu próprio cabeçalho, então trocar de aba desloca a tela inteira.

---

### Task 1: A escala de carga

**Files:**
- Create: `src/lib/visita/carga.ts`
- Test: `tests/visita/carga.test.ts`

**Interfaces:**
- Produces: `nivelDeCarga(n: number): 0 | 1 | 2 | 3` e `CARGA: readonly { fundo: string; texto: string }[]` indexado pelo nível.

- [ ] **Step 1: Escrever o teste que falha**

```ts
import { describe, it, expect } from 'vitest'
import { nivelDeCarga, CARGA } from '@/lib/visita/carga'

describe('nivelDeCarga', () => {
  it('dia vazio é nível zero', () => {
    expect(nivelDeCarga(0)).toBe(0)
  })

  it('sobe de faixa nas fronteiras certas', () => {
    expect([1, 2].map(nivelDeCarga)).toEqual([1, 1])
    expect([3, 4].map(nivelDeCarga)).toEqual([2, 2])
    expect([5, 9, 40].map(nivelDeCarga)).toEqual([3, 3, 3])
  })

  it('número negativo não quebra a escala', () => {
    expect(nivelDeCarga(-1)).toBe(0)
  })

  it('todo nível tem par de cores', () => {
    expect(CARGA).toHaveLength(4)
    for (const c of CARGA) {
      expect(c.fundo).toBeTruthy()
      expect(c.texto).toBeTruthy()
    }
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/visita/carga.test.ts`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar**

```ts
/**
 * Quanto trabalho tem num dia, em quatro faixas.
 *
 * O mês precisa responder "que dia está cheio" de relance, sem contar
 * bolinha. Quatro faixas bastam para isso e não fingem uma precisão que a
 * vista não tem: entre um dia de sete e outro de nove visitas, a decisão do
 * vendedor é a mesma.
 */
export function nivelDeCarga(n: number): 0 | 1 | 2 | 3 {
  if (n <= 0) return 0
  if (n <= 2) return 1
  if (n <= 4) return 2
  return 3
}

/**
 * A escala, do vazio ao cheio.
 *
 * Um matiz só, do claro ao escuro — é uma medida de quantidade, e quantidade
 * se lê em intensidade. O azul é o mesmo de "a fazer" nos gráficos, então a
 * paleta não ganha cor nova.
 *
 * A cor nunca informa sozinha: a célula sempre mostra o número, e o
 * `aria-label` diz o dia e a contagem por extenso.
 */
export const CARGA = [
  { fundo: 'bg-slate-50', texto: 'text-slate-400' },
  { fundo: 'bg-[#dbeafe]', texto: 'text-slate-900' },
  { fundo: 'bg-[#93c5fd]', texto: 'text-slate-900' },
  { fundo: 'bg-[#1f6fb2]', texto: 'text-white' },
] as const
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run tests/visita/carga.test.ts`
Expected: PASS (4 testes).

- [ ] **Step 5: Commit**

```bash
git add src/lib/visita/carga.ts tests/visita/carga.test.ts
git commit -m "feat(agenda): escala de carga do dia, em quatro faixas"
```

---

### Task 2: Mês por intensidade

**Files:**
- Modify: `src/app/(app)/agenda/GradeDoMes.tsx`

**Interfaces:**
- Consumes: `nivelDeCarga`, `CARGA` de `@/lib/visita/carga`

**Decisão registrada:** os pontinhos mostravam a divisão por status; a intensidade mostra só o total. É perda deliberada. No mês a pergunta é "que dia está cheio", para escolher onde entrar; a divisão por status é pergunta da visão de dia, a um toque de distância. Vinte e quatro bolinhas de 6px não respondiam nem uma nem outra.

- [ ] **Step 1: Substituir os pontinhos pela intensidade**

Apagar a constante `PONTOS` e trocar o corpo do `<Link>` de cada dia por:

```tsx
const nivel = nivelDeCarga(total)
const cor = CARGA[nivel]
const ehHoje = d === hojeISO
const doMes = d.slice(0, 7) === mesCorrente

return (
  <Link
    key={d}
    href={linkDoDia(d)}
    aria-label={`Dia ${Number(d.slice(8, 10))} — ${total} ${total === 1 ? 'visita' : 'visitas'}`}
    className={`flex h-16 flex-col justify-between rounded-xl p-1.5 transition-colors ${
      ehHoje ? 'bg-asfalto text-white' : doMes ? cor.fundo : 'bg-white'
    } ${!doMes && 'opacity-40'}`}
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
```

A altura cai de `h-20` para `h-16` (64px): sem as bolinhas não é preciso tanto espaço, e um mês inteiro passa a caber sem rolagem no celular. Continua acima dos 44px de alvo mínimo.

- [ ] **Step 2: Atualizar o comentário do arquivo**

Substituir o parágrafo sobre pontinhos por um que explique a intensidade e por que a divisão por status saiu.

- [ ] **Step 3: Compilar**

Run: `npm run build`
Expected: sucesso.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(app)/agenda/GradeDoMes.tsx"
git commit -m "feat(agenda): o mês mostra carga por intensidade, não por bolinhas"
```

---

### Task 3: Semana no celular

**Files:**
- Create: `src/app/(app)/agenda/SemanaNoCelular.tsx`
- Modify: `src/app/(app)/agenda/GradeDaSemana.tsx` — remover o ramo do celular
- Modify: `src/app/(app)/agenda/page.tsx` — usar os dois

**Interfaces:**
- Consumes: `VisitaDoDia` de `@/lib/visita/repositorio`; `nivelDeCarga`, `CARGA`
- Produces: `SemanaNoCelular({ dias, visitas, diaAtivo, hojeISO, linkDoDia, mostrarVendedor })`

**Decisão registrada:** a faixa mostra os sete dias com suas contagens, e é isso que distingue esta visão da de dia — sem a faixa, "semana" seria só "dia" com outro nome.

- [ ] **Step 1: Escrever `SemanaNoCelular.tsx`**

Uma faixa horizontal de sete links (dia da semana, número, contagem, fundo pela intensidade), com o dia ativo destacado, e abaixo a lista de visitas daquele dia — reaproveitando `ListaDoDia`. O dia ativo vem da URL, via `linkDoDia`.

```tsx
import Link from 'next/link'
import { nivelDeCarga, CARGA } from '@/lib/visita/carga'
import { ListaDoDia } from './ListaDoDia'
import type { VisitaDoDia } from '@/lib/visita/repositorio'

const CURTOS = ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom']

export function SemanaNoCelular({
  dias,
  visitas,
  diaAtivo,
  hojeISO,
  linkDoDia,
  mostrarVendedor,
}: {
  dias: string[]
  visitas: VisitaDoDia[]
  diaAtivo: string
  hojeISO: string
  linkDoDia: (data: string) => string
  mostrarVendedor: boolean
}) {
  const porDia = new Map<string, VisitaDoDia[]>()
  for (const v of visitas) {
    const lista = porDia.get(v.data) ?? []
    lista.push(v)
    porDia.set(v.data, lista)
  }

  const doDiaAtivo = porDia.get(diaAtivo) ?? []

  return (
    <div className="flex flex-col gap-3 lg:hidden">
      <div className="grid grid-cols-7 gap-1">
        {dias.map((d, i) => {
          const n = (porDia.get(d) ?? []).length
          const cor = CARGA[nivelDeCarga(n)]
          const ativo = d === diaAtivo
          return (
            <Link
              key={d}
              href={linkDoDia(d)}
              aria-label={`${CURTOS[i]}, dia ${Number(d.slice(8, 10))} — ${n} ${n === 1 ? 'visita' : 'visitas'}`}
              aria-current={ativo ? 'date' : undefined}
              className={`flex h-16 flex-col items-center justify-center gap-0.5 rounded-xl transition-colors ${
                ativo ? 'bg-asfalto text-white ring-2 ring-asfalto' : cor.fundo
              }`}
            >
              <span
                className={`text-[10px] font-bold uppercase ${ativo ? 'text-white/70' : 'text-slate-500'}`}
              >
                {CURTOS[i]}
              </span>
              <span
                className={`font-display text-base font-semibold ${ativo ? 'text-white' : cor.texto}`}
              >
                {Number(d.slice(8, 10))}
              </span>
              <span className={`text-[10px] ${ativo ? 'text-white/70' : cor.texto}`}>
                {n || '—'}
              </span>
            </Link>
          )
        })}
      </div>

      <ListaDoDia visitas={doDiaAtivo} mostrarVendedor={mostrarVendedor} />
    </div>
  )
}
```

- [ ] **Step 2: Tirar o ramo do celular de `GradeDaSemana`**

Apagar o bloco `<div className="flex flex-col gap-4 lg:hidden">` inteiro e o fragmento `<>...</>` que o envolvia, deixando só a grade `hidden ... lg:grid`. Se `Cabecalho` ficar sem uso, remover junto — é órfão criado por esta mudança.

- [ ] **Step 3: Ligar os dois em `page.tsx`**

Onde hoje há `{v === 'semana' && (<GradeDaSemana ... />)}`, passar a renderizar os dois, cada um com sua faixa de tela:

```tsx
{v === 'semana' && (
  <>
    <GradeDaSemana
      dias={dias}
      visitas={visitas}
      hojeISO={hojeISO}
      mostrarVendedor={vendoTodos}
      linkDoDia={(d) => link({ data: d, vista: 'dia' })}
    />
    <SemanaNoCelular
      dias={dias}
      visitas={visitas}
      diaAtivo={data}
      hojeISO={hojeISO}
      mostrarVendedor={vendoTodos}
      linkDoDia={(d) => link({ data: d, vista: 'semana' })}
    />
  </>
)}
```

O link da faixa mantém `vista: 'semana'` — tocar num dia troca o dia mostrado, não a visão.

- [ ] **Step 4: Rodar tudo**

Run: `npx vitest run && npm run build`
Expected: tudo passa.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(app)/agenda/SemanaNoCelular.tsx" "src/app/(app)/agenda/GradeDaSemana.tsx" "src/app/(app)/agenda/page.tsx"
git commit -m "feat(agenda): semana no celular vira faixa de dias e lista"
```

---

### Task 4: Cabeçalho constante

**Files:**
- Modify: `src/app/(app)/agenda/page.tsx`

- [ ] **Step 1: Unificar o cabeçalho das três visões**

Um único bloco no topo, igual nas três: à esquerda o período com as setas de anterior e próximo; à direita as abas dia/semana/mês. Nada dele muda ao trocar de visão — só o conteúdo abaixo.

- [ ] **Step 2: Garantir 44px nos controles**

As setas e as abas recebem `min-h-11` (44px), que é o mínimo para o polegar.

- [ ] **Step 3: Rodar tudo**

Run: `npx vitest run && npm run build`
Expected: tudo passa.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(app)/agenda/page.tsx"
git commit -m "feat(agenda): um cabeçalho só, que não se mexe ao trocar de visão"
```

---

## Autorrevisão

**Cobertura da spec.** Mês por intensidade (Tasks 1 e 2); semana como faixa e lista (Task 3); cabeçalho constante (Task 4); alvo de toque de 44px (Tasks 2, 3 e 4); dia selecionado na URL (Task 3); grade de sete colunas preservada no notebook (Task 3).

**Acabamento da lista do dia** — previsto na spec, não virou tarefa: ao ler `ListaDoDia`, o horário já tem peso, o cliente já é a linha forte e o status já é etiqueta. O que a spec pedia já está feito, e mexer só para cumprir a lista seria mudança sem motivo.

**Consistência de tipos.** `nivelDeCarga` devolve índice de `CARGA`, usado nas Tasks 2 e 3. `SemanaNoCelular` recebe `VisitaDoDia[]`, o mesmo tipo que `GradeDaSemana` e `ListaDoDia` já recebem.

**Testes.** Lógica pura apenas: `nivelDeCarga` e a integridade da escala. O resto é composição visual, que este projeto não testa automaticamente — e que precisa ser conferida no aparelho.

## Fora do escopo

- Reordenar ou priorizar visitas.
- Arrastar para reagendar.
- `prefetch={false}` nos cartões de visita.
