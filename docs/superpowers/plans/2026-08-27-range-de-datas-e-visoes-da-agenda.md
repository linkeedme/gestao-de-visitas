# Range de datas e visões da agenda — Plano de implementação

> **Para quem executa com agente:** SUB-SKILL OBRIGATÓRIA: use `superpowers:subagent-driven-development` (recomendado) ou `superpowers:executing-plans` para implementar tarefa por tarefa. Os passos usam checkbox (`- [ ]`) para acompanhamento.

**Objetivo:** filtrar os relatórios por um intervalo de datas livre e ler a agenda em dia, semana e mês.

**Arquitetura:** quatro funções de data em UTC sustentam tudo. Os relatórios passam a ler `de`/`ate` da URL por uma função pura compartilhada com a rota do CSV. A agenda continua numa rota só, com `?vista=`, e ganha dois componentes de servidor sem estado — a semana lista visitas, o mês lê contagens agregadas no banco.

**Stack:** Next.js 16 (App Router, React Server Components), React 19, Drizzle ORM sobre Postgres, Tailwind 4, Vitest com PGlite (Postgres em memória).

**Spec:** [2026-08-27 — Range de datas e visões da agenda](../specs/2026-08-27-range-de-datas-e-visoes-da-agenda-design.md)

## Restrições globais

- **Nenhuma dependência nova.** Sem biblioteca de calendário, sem biblioteca de datas.
- **Nenhuma migração de banco.** Nenhuma coluna nova, nenhum índice novo.
- **Toda aritmética de data roda em UTC.** `new Date('2026-08-25')` é meia-noite UTC; somar dias em fuso local faz o dia escorregar em UTC-3. Este projeto já corrigiu esse bug três vezes — veja o comentário de `somarDias` em `src/lib/visita/datas.ts`.
- **A semana começa na segunda e termina no domingo.**
- **Nada de `use client` nos componentes novos.** As ações de status vivem só no `ListaDoDia`.
- **Português nos nomes**, como todo o resto do código (`inicioDaSemana`, não `startOfWeek`).
- **Comentários explicam o porquê, não o quê.** É o padrão do repositório: veja `datas.ts`, `repositorio.ts`, `vitest.config.mts`.
- **Antes de escrever código de Next.js**, leia o guia relevante em `node_modules/next/dist/docs/` — esta versão tem mudanças em relação ao que você conhece (veja `AGENTS.md`).
- Rodar a suíte inteira: `npm test`. Um arquivo só: `npx vitest run tests/caminho/arquivo.test.ts`.
- Checagem de tipos: `npx tsc --noEmit`. O Vitest **não** type-checa; erro de tipo só aparece aqui ou no `next build`.

---

## Estrutura de arquivos

| Arquivo | Responsabilidade | Tarefa |
|---|---|---|
| `src/lib/visita/datas.ts` | aritmética de data pura, em UTC | 1 |
| `src/lib/visita/periodo.ts` (novo) | interpretar o filtro de período da URL | 2 |
| `src/app/(app)/relatorios/page.tsx` | tela de relatórios: atalhos + formulário de range | 3 |
| `src/app/api/relatorios/csv/route.ts` | exportação, lendo o período pela mesma regra da tela | 3 |
| `src/lib/visita/repositorio.ts` | consultas de visita | 4 |
| `src/lib/visita/agenda.ts` (novo) | qual intervalo cada visão cobre e como as setas andam | 5 |
| `src/app/(app)/agenda/page.tsx` | escolhe a visão, busca os dados, monta o cabeçalho | 5 |
| `src/app/(app)/agenda/GradeDaSemana.tsx` (novo) | sete colunas no notebook, lista no celular | 5 |
| `src/app/(app)/agenda/GradeDoMes.tsx` (novo) | calendário 6×7 com contadores | 6 |

**Nota sobre `src/lib/visita/agenda.ts`:** a spec (seção 8) não previa este arquivo. Ele existe porque `intervaloDaVista` e `passoDaVista` são lógica de calendário pura, e deixá-las dentro do `page.tsx` as tornaria não-testáveis — o projeto não tem andaime para testar componente React (`vitest.config.mts` usa `environment: 'node'`). É o mesmo motivo que tirou `intervaloDoFiltro` de dentro da tela de relatórios.

---

## Tarefa 1: Fundação de datas

**Arquivos:**
- Modificar: `src/lib/visita/datas.ts` (acrescentar ao fim)
- Testar: `tests/visita/datas.test.ts` (acrescentar ao fim)

**Interfaces:**
- Consome: `somarDias(data: string, dias: number): string`, que já existe no arquivo.
- Produz:
  - `inicioDaSemana(data: string): string`
  - `inicioDoMes(data: string): string`
  - `fimDoMes(data: string): string`
  - `diasEntre(de: string, ate: string): string[]`

Todas recebem e devolvem `'AAAA-MM-DD'`.

**Referência de calendário para os testes** (confira antes de duvidar de um caso): em 2026, **24/08 é segunda**, 27/08 é quinta, 30/08 é domingo, 31/08 é segunda e 01/09 é terça.

- [ ] **Passo 1: Escrever os testes que falham**

Acrescente ao fim de `tests/visita/datas.test.ts`, e atualize a linha de `import` no topo do arquivo para incluir as quatro funções novas:

```ts
import {
  hoje,
  formatarDia,
  somarDias,
  inicioDaSemana,
  inicioDoMes,
  fimDoMes,
  diasEntre,
} from '@/lib/visita/datas'
```

```ts
describe('inicioDaSemana', () => {
  it('recua até a segunda-feira', () => {
    // 27/08/2026 é uma quinta.
    expect(inicioDaSemana('2026-08-27')).toBe('2026-08-24')
  })

  it('devolve a própria data quando já é segunda', () => {
    expect(inicioDaSemana('2026-08-24')).toBe('2026-08-24')
  })

  it('trata domingo como fim da semana, não como começo', () => {
    // O erro clássico: getUTCDay() devolve 0 para domingo, e uma conta
    // ingênua faria o domingo abrir a semana seguinte.
    expect(inicioDaSemana('2026-08-30')).toBe('2026-08-24')
  })

  it('atravessa a virada de mês', () => {
    // 01/09 é terça; a semana dela começou em agosto.
    expect(inicioDaSemana('2026-09-01')).toBe('2026-08-31')
  })

  it('atravessa a virada de ano', () => {
    // 01/01/2027 é uma sexta.
    expect(inicioDaSemana('2027-01-01')).toBe('2026-12-28')
  })
})

describe('inicioDoMes', () => {
  it('devolve o dia 1', () => {
    expect(inicioDoMes('2026-08-27')).toBe('2026-08-01')
    expect(inicioDoMes('2026-08-01')).toBe('2026-08-01')
  })
})

describe('fimDoMes', () => {
  it('acerta mês de 31 e de 30 dias', () => {
    expect(fimDoMes('2026-08-15')).toBe('2026-08-31')
    expect(fimDoMes('2026-04-10')).toBe('2026-04-30')
  })

  it('acerta fevereiro comum e bissexto', () => {
    expect(fimDoMes('2026-02-05')).toBe('2026-02-28')
    expect(fimDoMes('2028-02-05')).toBe('2028-02-29')
  })

  it('não vira o ano em dezembro', () => {
    expect(fimDoMes('2026-12-31')).toBe('2026-12-31')
  })
})

describe('diasEntre', () => {
  it('inclui as duas pontas', () => {
    const semana = diasEntre('2026-08-24', '2026-08-30')

    expect(semana).toHaveLength(7)
    expect(semana[0]).toBe('2026-08-24')
    expect(semana[6]).toBe('2026-08-30')
  })

  it('devolve um único dia quando as pontas são iguais', () => {
    expect(diasEntre('2026-08-25', '2026-08-25')).toEqual(['2026-08-25'])
  })

  it('atravessa virada de mês e de ano', () => {
    expect(diasEntre('2026-08-30', '2026-09-02')).toEqual([
      '2026-08-30',
      '2026-08-31',
      '2026-09-01',
      '2026-09-02',
    ])
    expect(diasEntre('2026-12-31', '2027-01-01')).toEqual(['2026-12-31', '2027-01-01'])
  })

  it('devolve vazio quando o fim vem antes do começo', () => {
    expect(diasEntre('2026-08-30', '2026-08-24')).toEqual([])
  })
})
```

- [ ] **Passo 2: Rodar os testes e confirmar que falham**

```
npx vitest run tests/visita/datas.test.ts
```

Esperado: FAIL. As mensagens citam `inicioDaSemana is not a function` (ou erro de importação) — as funções ainda não existem.

- [ ] **Passo 3: Implementar**

Acrescente ao fim de `src/lib/visita/datas.ts`:

```ts
/**
 * A segunda-feira da semana daquela data.
 *
 * A semana começa na segunda porque é a semana comercial de quem vende:
 * alinhar a grade pelo domingo colocaria o fim de semana no meio do
 * raciocínio de planejamento.
 *
 * O `+ 6` antes do resto existe por causa de `getUTCDay()`, que devolve 0
 * para domingo. Sem ele, domingo recuaria zero dias e abriria uma semana
 * própria, deixando a grade com uma coluna órfã.
 */
export function inicioDaSemana(data: string): string {
  const [ano, mes, dia] = data.split('-').map(Number)
  const d = new Date(Date.UTC(ano, mes - 1, dia))
  const desdeSegunda = (d.getUTCDay() + 6) % 7
  return somarDias(data, -desdeSegunda)
}

/** O dia 1 daquele mês. Recorte de string: a data já é só uma data. */
export function inicioDoMes(data: string): string {
  return `${data.slice(0, 7)}-01`
}

/**
 * O último dia daquele mês.
 *
 * `Date.UTC(ano, mes, 0)` é o dia zero do mês seguinte, que o próprio Date
 * resolve como o último dia deste — e acerta fevereiro bissexto sem tabela
 * nenhuma. Note que `mes` aqui é 1-based e não leva o `- 1` de costume,
 * justamente porque a conta quer o mês seguinte.
 */
export function fimDoMes(data: string): string {
  const [ano, mes] = data.split('-').map(Number)
  return new Date(Date.UTC(ano, mes, 0)).toISOString().slice(0, 10)
}

/**
 * Todos os dias do intervalo, inclusivo nas duas pontas.
 *
 * É a peça que a grade da semana, a grade do mês e o preenchimento de dias
 * vazios compartilham — um dia sem visita precisa existir na lista para
 * aparecer vazio na tela em vez de sumir dela.
 *
 * A comparação é entre strings de propósito: 'AAAA-MM-DD' ordena
 * lexicograficamente igual à ordem cronológica, e comparar assim evita
 * construir um Date por iteração.
 */
export function diasEntre(de: string, ate: string): string[] {
  const dias: string[] = []
  for (let d = de; d <= ate; d = somarDias(d, 1)) dias.push(d)
  return dias
}
```

- [ ] **Passo 4: Rodar os testes e confirmar que passam**

```
npx vitest run tests/visita/datas.test.ts
```

Esperado: PASS, com os casos antigos (`formatarDia`, `hoje`, `somarDias`) continuando verdes.

- [ ] **Passo 5: Commitar**

```
git add src/lib/visita/datas.ts tests/visita/datas.test.ts
git commit -m "feat(datas): semana, mês e intervalo de dias em UTC"
```

---

## Tarefa 2: Interpretar o período da URL

**Arquivos:**
- Criar: `src/lib/visita/periodo.ts`
- Testar: `tests/visita/periodo.test.ts` (novo)

**Interfaces:**
- Consome: `somarDias` de `@/lib/visita/datas`.
- Produz:
  - `ATALHOS: readonly { dias: number; rotulo: string }[]`
  - `type Intervalo = { de: string; ate: string; atalhoAtivo: number | null }`
  - `type ParamsPeriodo = { de?: string; ate?: string; periodo?: string }`
  - `intervaloDoFiltro(params: ParamsPeriodo, hojeISO: string): Intervalo`

`hojeISO` entra por parâmetro, e não é lido de `hoje()` lá dentro, para o teste poder fixar a data sem mexer no relógio do processo.

**Atenção — os `dias` dos atalhos são offsets, não durações.** "30 dias" é `dias: 29`, porque o intervalo é inclusivo nas duas pontas. É como o código de hoje já faz em `relatorios/page.tsx`; mantenha assim para os links antigos continuarem valendo.

- [ ] **Passo 1: Escrever os testes que falham**

Crie `tests/visita/periodo.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { intervaloDoFiltro } from '@/lib/visita/periodo'

const HOJE = '2026-08-27'

describe('intervaloDoFiltro', () => {
  it('usa de e ate quando os dois são válidos e estão em ordem', () => {
    const r = intervaloDoFiltro({ de: '2026-07-15', ate: '2026-08-03' }, HOJE)

    expect(r).toEqual({ de: '2026-07-15', ate: '2026-08-03', atalhoAtivo: null })
  })

  it('completa com hoje quando só o de vem', () => {
    const r = intervaloDoFiltro({ de: '2026-08-01' }, HOJE)

    expect(r.de).toBe('2026-08-01')
    expect(r.ate).toBe(HOJE)
  })

  it('recua 29 dias quando só o ate vem', () => {
    const r = intervaloDoFiltro({ ate: '2026-08-03' }, HOJE)

    expect(r).toMatchObject({ de: '2026-07-05', ate: '2026-08-03' })
  })

  it('aceita período no futuro, para o gestor ver o que está marcado', () => {
    const r = intervaloDoFiltro({ de: '2026-09-01', ate: '2026-09-30' }, HOJE)

    expect(r).toMatchObject({ de: '2026-09-01', ate: '2026-09-30' })
  })

  it('mostra só aquele dia quando o de está no futuro e não veio ate', () => {
    // Completar com hoje deixaria o intervalo invertido.
    const r = intervaloDoFiltro({ de: '2026-09-10' }, HOJE)

    expect(r).toMatchObject({ de: '2026-09-10', ate: '2026-09-10' })
  })

  it('cai nos últimos 30 dias quando o formato não é data', () => {
    const r = intervaloDoFiltro({ de: 'ontem', ate: '03/08/2026' }, HOJE)

    expect(r).toMatchObject({ de: '2026-07-29', ate: HOJE })
  })

  it('cai nos últimos 30 dias quando a data não existe no calendário', () => {
    // Casa com o regex e não existe: é o caso que um regex sozinho deixa passar.
    const r = intervaloDoFiltro({ de: '2026-02-30', ate: '2026-08-03' }, HOJE)

    expect(r).toMatchObject({ de: '2026-07-29', ate: HOJE })
  })

  it('cai nos últimos 30 dias quando o de vem depois do ate', () => {
    const r = intervaloDoFiltro({ de: '2026-08-20', ate: '2026-08-01' }, HOJE)

    expect(r).toMatchObject({ de: '2026-07-29', ate: HOJE })
  })

  it('apara intervalo maior que 731 dias, sem mexer no ate', () => {
    const r = intervaloDoFiltro({ de: '2020-01-01', ate: '2026-08-03' }, HOJE)

    // 731 dias antes de 03/08/2026 é 02/08/2024, não 03/08: nem 2025 nem
    // 2026 são bissextos, então dois anos ali somam 730 dias.
    expect(r.ate).toBe('2026-08-03')
    expect(r.de).toBe('2024-08-02')
  })

  it('traduz o parâmetro periodo antigo', () => {
    const r = intervaloDoFiltro({ periodo: '89' }, HOJE)

    expect(r).toMatchObject({ de: '2026-05-30', ate: HOJE })
  })

  it('ignora periodo quando de e ate vieram', () => {
    const r = intervaloDoFiltro({ de: '2026-08-01', ate: '2026-08-02', periodo: '364' }, HOJE)

    expect(r).toMatchObject({ de: '2026-08-01', ate: '2026-08-02' })
  })

  it('cai nos últimos 30 dias quando não vem nada', () => {
    const r = intervaloDoFiltro({}, HOJE)

    expect(r).toMatchObject({ de: '2026-07-29', ate: HOJE })
  })

  it('marca o atalho quando o intervalo bate com ele exatamente', () => {
    expect(intervaloDoFiltro({}, HOJE).atalhoAtivo).toBe(29)
    expect(intervaloDoFiltro({ periodo: '6' }, HOJE).atalhoAtivo).toBe(6)
    expect(intervaloDoFiltro({ de: '2026-08-21', ate: HOJE }, HOJE).atalhoAtivo).toBe(6)
  })

  it('não marca atalho nenhum quando o período é personalizado', () => {
    // Mesmo tamanho de um atalho, mas terminando ontem: não é o atalho.
    expect(intervaloDoFiltro({ de: '2026-08-20', ate: '2026-08-26' }, HOJE).atalhoAtivo).toBeNull()
  })
})
```

- [ ] **Passo 2: Rodar os testes e confirmar que falham**

```
npx vitest run tests/visita/periodo.test.ts
```

Esperado: FAIL, com erro de módulo não encontrado (`Failed to resolve import "@/lib/visita/periodo"`).

- [ ] **Passo 3: Implementar**

Crie `src/lib/visita/periodo.ts`:

```ts
import { somarDias } from './datas'

/**
 * Os atalhos de período da tela de relatórios.
 *
 * `dias` é o quanto se recua a partir de hoje, não a duração: "30 dias" é 29
 * porque o intervalo inclui as duas pontas. Mexer nesses números quebra os
 * links antigos que ainda chegam com `?periodo=`.
 */
export const ATALHOS = [
  { dias: 6, rotulo: '7 dias' },
  { dias: 29, rotulo: '30 dias' },
  { dias: 89, rotulo: '90 dias' },
  { dias: 364, rotulo: '1 ano' },
] as const

/** O padrão quando não dá para entender o que veio na URL. */
const PADRAO = 29

/**
 * Dois anos. Acima disso não é pergunta de gestor, é URL digitada errada — e
 * uma consulta sem teto varreria a tabela inteira por causa de um dedo torto.
 */
const MAXIMO_DIAS = 731

export type Intervalo = { de: string; ate: string; atalhoAtivo: number | null }

export type ParamsPeriodo = { de?: string; ate?: string; periodo?: string }

/**
 * 'AAAA-MM-DD' que existe de verdade.
 *
 * O regex sozinho aprova `2026-02-30`. A ida e volta pelo Date pega isso: o
 * Date normaliza para 02/03 e a string deixa de bater.
 */
function dataValida(v: string | undefined): v is string {
  if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false
  const [ano, mes, dia] = v.split('-').map(Number)
  return new Date(Date.UTC(ano, mes - 1, dia)).toISOString().slice(0, 10) === v
}

/** Dias entre duas datas, pela conta em UTC que `clientesEmRisco` já usa. */
function distancia(de: string, ate: string): number {
  return Math.round(
    (Date.parse(`${ate}T00:00:00Z`) - Date.parse(`${de}T00:00:00Z`)) / 86_400_000
  )
}

/**
 * Lê o período pedido na URL, com um intervalo utilizável em qualquer caso.
 *
 * Uma URL torta não é motivo para uma tela quebrada: em vez de erro na cara
 * do gestor, o filtro cai para os últimos 30 dias. Vive fora do componente
 * para ser testado sem renderizar nada, e para a tela e a rota do CSV lerem
 * o período pela mesma regra — quando cada uma fazia essa conta do seu jeito,
 * planilha e tela começavam a discordar.
 *
 * `hojeISO` entra por parâmetro para o teste fixar a data sem tocar no
 * relógio do processo.
 */
export function intervaloDoFiltro(params: ParamsPeriodo, hojeISO: string): Intervalo {
  const dePedido = dataValida(params.de) ? params.de : undefined
  const atePedido = dataValida(params.ate) ? params.ate : undefined

  let de: string
  let ate: string

  if (dePedido && atePedido && dePedido <= atePedido) {
    de = dePedido
    ate = atePedido
  } else if (dePedido && !atePedido) {
    de = dePedido
    // Um `de` no futuro sozinho deixaria o intervalo invertido; então a
    // pergunta vira "o que tem naquele dia", que é o que a pessoa digitou.
    ate = dePedido > hojeISO ? dePedido : hojeISO
  } else if (atePedido && !dePedido) {
    ate = atePedido
    de = somarDias(ate, -PADRAO)
  } else {
    // Cai aqui também quando `de` veio depois de `ate`: o pedido não faz
    // sentido, e inverter por conta própria seria adivinhar.
    const legado = Number(params.periodo)
    ate = hojeISO
    de = somarDias(ate, -(Number.isInteger(legado) && legado > 0 ? legado : PADRAO))
  }

  if (distancia(de, ate) > MAXIMO_DIAS) de = somarDias(ate, -MAXIMO_DIAS)

  const atalho = ATALHOS.find((a) => ate === hojeISO && de === somarDias(hojeISO, -a.dias))
  return { de, ate, atalhoAtivo: atalho?.dias ?? null }
}
```

- [ ] **Passo 4: Rodar os testes e confirmar que passam**

```
npx vitest run tests/visita/periodo.test.ts
```

Esperado: PASS, 14 casos.

- [ ] **Passo 5: Commitar**

```
git add src/lib/visita/periodo.ts tests/visita/periodo.test.ts
git commit -m "feat(relatorios): leitura do periodo da URL, com queda para 30 dias"
```

---

## Tarefa 3: Range de datas na tela de relatórios e no CSV

**Arquivos:**
- Modificar: `src/app/(app)/relatorios/page.tsx`
- Modificar: `src/app/api/relatorios/csv/route.ts`
- Testar: `tests/visita/relatorios.test.ts` (novo)

**Interfaces:**
- Consome: `intervaloDoFiltro`, `ATALHOS` da Tarefa 2; `listarParaAuditoria` de `@/lib/visita/relatorios`, que já existe.
- Produz: nada que tarefas seguintes usem. É uma entrega fechada — depois dela o primeiro pedido está pronto e pode ir para produção.

- [ ] **Passo 1: Escrever o teste de borda que falha**

Crie `tests/visita/relatorios.test.ts`. O andaime de banco é o de `tests/apoio/banco.ts`, igual ao de `tests/visita/repositorio.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { criarBancoDeTeste, criarUsuarioDeTeste } from '../apoio/banco'
import { criarVisita } from '@/lib/visita/repositorio'
import { listarParaAuditoria } from '@/lib/visita/relatorios'

const CONTATO = '22222222-2222-2222-2222-222222222222'

let banco: Awaited<ReturnType<typeof criarBancoDeTeste>>
let usuarioId: string
let zapleUserId: string | null

beforeEach(async () => {
  banco = await criarBancoDeTeste()
  const u = await criarUsuarioDeTeste(banco.db)
  usuarioId = u.id
  zapleUserId = u.zapleUserId
})

afterEach(async () => {
  await banco.fechar()
})

function entrada(data: string) {
  return {
    contatoId: CONTATO,
    contatoNome: 'AUTOCAR',
    usuarioId,
    zapleUserId,
    data,
    titulo: 'AUTOCAR',
  }
}

describe('listarParaAuditoria', () => {
  it('inclui as duas bordas do intervalo e exclui o que está fora', async () => {
    // Um dia antes, as duas pontas, e um dia depois. Com `>` no lugar de
    // `>=` o gestor perderia silenciosamente o primeiro dia do mês.
    await criarVisita(banco.db, entrada('2026-07-31'))
    await criarVisita(banco.db, entrada('2026-08-01'))
    await criarVisita(banco.db, entrada('2026-08-15'))
    await criarVisita(banco.db, entrada('2026-08-31'))
    await criarVisita(banco.db, entrada('2026-09-01'))

    const linhas = await listarParaAuditoria(banco.db, { de: '2026-08-01', ate: '2026-08-31' })

    expect(linhas.map((l) => l.data).sort()).toEqual(['2026-08-01', '2026-08-15', '2026-08-31'])
  })

  it('aceita intervalo no futuro', async () => {
    await criarVisita(banco.db, entrada('2026-09-10'))

    const linhas = await listarParaAuditoria(banco.db, { de: '2026-09-01', ate: '2026-09-30' })

    expect(linhas).toHaveLength(1)
  })

  it('combina o filtro de status com o de período', async () => {
    await criarVisita(banco.db, entrada('2026-08-15'))

    const aFazer = await listarParaAuditoria(banco.db, {
      de: '2026-08-01',
      ate: '2026-08-31',
      status: 'a_fazer',
    })
    const realizadas = await listarParaAuditoria(banco.db, {
      de: '2026-08-01',
      ate: '2026-08-31',
      status: 'realizada',
    })

    expect(aFazer).toHaveLength(1)
    expect(realizadas).toHaveLength(0)
  })
})
```

- [ ] **Passo 2: Rodar e confirmar que falha**

```
npx vitest run tests/visita/relatorios.test.ts
```

Esperado: **PASS**, os três casos. Estes são testes de regressão, não de funcionalidade nova — `listarParaAuditoria` já usa `gte`/`lte`, e o que eles fixam é que o range livre não pode perder o primeiro nem o último dia do intervalo quando alguém for otimizar essa consulta. Se algum falhar, o bug é real e você o encontrou antes de os usuários encontrarem: pare e conserte `listarParaAuditoria` antes de seguir.

- [ ] **Passo 3: Trocar o período por `de`/`ate` na tela**

Em `src/app/(app)/relatorios/page.tsx`:

Remova a constante `PERIODOS` inteira e acrescente um import. As três funções de `datas` continuam sendo usadas — `somarDias` agora só nos links dos atalhos:

```tsx
import { hoje, somarDias, formatarDia } from '@/lib/visita/datas'
import { ATALHOS, intervaloDoFiltro } from '@/lib/visita/periodo'
```

Troque o começo do componente. O que hoje é:

```tsx
  const { periodo, vendedor, status } = await searchParams

  const dias = Number(typeof periodo === 'string' ? periodo : 29)
  const diasValidos = PERIODOS.some((p) => p.dias === dias) ? dias : 29
  const ate = hoje()
  const de = somarDias(ate, -diasValidos)
  const usuarioId = typeof vendedor === 'string' && vendedor ? vendedor : undefined
```

passa a ser:

```tsx
  const { de: deParam, ate: ateParam, periodo, vendedor, status } = await searchParams

  const texto = (v: unknown) => (typeof v === 'string' && v ? v : undefined)
  const hojeISO = hoje()
  const { de, ate, atalhoAtivo } = intervaloDoFiltro(
    { de: texto(deParam), ate: texto(ateParam), periodo: texto(periodo) },
    hojeISO
  )
  const usuarioId = texto(vendedor)
```

Substitua o construtor de links. O que hoje é `const base = ...` e `const comFiltros = ...` passa a ser uma função só:

```tsx
  /**
   * Um construtor de link para a tela inteira.
   *
   * Cada filtro precisa preservar os outros: trocar o vendedor não pode
   * jogar o gestor de volta para os 30 dias padrão, e trocar a data não pode
   * apagar o status que ele acabou de escolher.
   */
  const link = (troca: { de?: string; ate?: string; vendedor?: string; status?: string } = {}) => {
    const p = new URLSearchParams({ de: troca.de ?? de, ate: troca.ate ?? ate })
    const v = troca.vendedor ?? usuarioId
    const s = troca.status ?? statusFiltro
    if (v) p.set('vendedor', v)
    if (s) p.set('status', s)
    return `/relatorios?${p}`
  }
```

Troque os botões de período pelos atalhos mais o formulário. O bloco `<div className="flex flex-wrap gap-2">{PERIODOS.map(...)}</div>` vira:

```tsx
      <div className="flex flex-wrap gap-2">
        {ATALHOS.map((a) => (
          <Link
            key={a.dias}
            href={link({ de: somarDias(hojeISO, -a.dias), ate: hojeISO })}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
              a.dias === atalhoAtivo
                ? 'bg-asfalto text-white'
                : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'
            }`}
          >
            {a.rotulo}
          </Link>
        ))}
      </div>

      {/* Um GET puro, sem JavaScript: o `type="date"` abre o calendário
          nativo do aparelho, e a tela continua inteira no servidor. Os
          campos escondidos carregam vendedor e status porque trocar a data
          não pode apagar o filtro que o gestor acabou de escolher. */}
      <form
        method="get"
        action="/relatorios"
        className="flex flex-wrap items-end gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200/70"
      >
        <label className="flex flex-col gap-1">
          <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">De</span>
          <input
            type="date"
            name="de"
            defaultValue={de}
            className="rounded-xl bg-slate-50 px-3 py-2 text-sm ring-1 ring-slate-200"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Até</span>
          <input
            type="date"
            name="ate"
            defaultValue={ate}
            className="rounded-xl bg-slate-50 px-3 py-2 text-sm ring-1 ring-slate-200"
          />
        </label>
        {usuarioId && <input type="hidden" name="vendedor" value={usuarioId} />}
        {statusFiltro && <input type="hidden" name="status" value={statusFiltro} />}
        <button
          type="submit"
          className="rounded-xl bg-asfalto px-4 py-2.5 text-sm font-semibold text-white"
        >
          Aplicar
        </button>
      </form>
```

Troque as chamadas de link que sobraram no arquivo:

- `href={comFiltros({ vendedor: k.usuarioId })}` → `href={link({ vendedor: k.usuarioId })}`
- `href={base}` (o "limpar filtros") → `href={link({ vendedor: '', status: '' })}`
- `comFiltros({ vendedor: '' })`, `comFiltros({ vendedor: v.id })`, `comFiltros({ status: '' })`, `comFiltros({ status: chave })` → as mesmas chamadas com `link`

E o link de baixar planilha ganha o status:

```tsx
      <a
        href={`/api/relatorios/csv?de=${de}&ate=${ate}${usuarioId ? `&usuarioId=${usuarioId}` : ''}${statusFiltro ? `&status=${statusFiltro}` : ''}`}
```

Por fim, o subtítulo do bloco de alertas. O `<h2>` de "Precisa de atenção" ganha um parágrafo abaixo:

```tsx
          <h2 className="px-1 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
            Precisa de atenção
          </h2>
          <p className="-mt-1 px-1 text-sm text-slate-500">
            Atrasadas e clientes sem visita olham para hoje, não para o período — atraso é uma
            pergunta sobre agora. Reagendados em série e realizadas sem relato seguem o período.
          </p>
```

- [ ] **Passo 4: Fazer o CSV ler o período pela mesma regra**

Em `src/app/api/relatorios/csv/route.ts`, troque os imports e o bloco de parâmetros.

Import:

```ts
import { formatarDia, hoje } from '@/lib/visita/datas'
import { intervaloDoFiltro } from '@/lib/visita/periodo'
```

(`somarDias` sai — quem recua os dias agora é o `intervaloDoFiltro`.)

O que hoje é:

```ts
  const ate = url.searchParams.get('ate') ?? hoje()
  const de = url.searchParams.get('de') ?? somarDias(ate, -29)
  const usuarioId = url.searchParams.get('usuarioId') ?? undefined

  const visitas = await listarParaAuditoria(db, { de, ate, usuarioId })
```

passa a ser:

```ts
  // A mesma leitura da tela, para a planilha nunca discordar do que está na
  // frente do gestor quando ele clica em baixar.
  const { de, ate } = intervaloDoFiltro(
    {
      de: url.searchParams.get('de') ?? undefined,
      ate: url.searchParams.get('ate') ?? undefined,
      periodo: url.searchParams.get('periodo') ?? undefined,
    },
    hoje()
  )
  const usuarioId = url.searchParams.get('usuarioId') ?? undefined

  // Sem isto, o gestor filtra "Canceladas" na tela, baixa a planilha, recebe
  // tudo, e conclui que o download está quebrado.
  const statusPedido = url.searchParams.get('status')
  const status =
    statusPedido && statusPedido in STATUS
      ? (statusPedido as 'a_fazer' | 'realizada' | 'cancelada' | 'reagendada')
      : undefined

  const visitas = await listarParaAuditoria(db, { de, ate, usuarioId, status })
```

- [ ] **Passo 5: Rodar os testes e a checagem de tipos**

```
npm test
npx tsc --noEmit
```

Esperado: PASS na suíte inteira, e nenhuma saída do `tsc`. Se o `tsc` reclamar de `comFiltros` ou `PERIODOS`, sobrou referência ao código antigo.

- [ ] **Passo 6: Conferir na tela**

```
npm run dev
```

Abra `/relatorios` como gestor e confirme:

1. "30 dias" começa destacado; clicar em "90 dias" muda o subtítulo de datas e o destaque.
2. Digitar `de` e `ate` e clicar em Aplicar muda o período, e **nenhum atalho fica destacado**.
3. Escolher um vendedor, depois trocar a data: o vendedor continua escolhido.
4. Escolher status "Canceladas", baixar a planilha: o arquivo só traz canceladas.
5. Pedir um período no futuro (`?de=2026-09-01&ate=2026-09-30`): aparecem as visitas a fazer daquele mês.
6. Uma URL torta (`?de=abacaxi`) abre nos últimos 30 dias, sem erro.

- [ ] **Passo 7: Commitar**

```
git add src/app/(app)/relatorios/page.tsx src/app/api/relatorios/csv/route.ts tests/visita/relatorios.test.ts
git commit -m "feat(relatorios): filtrar por intervalo de datas livre"
```

---

## Tarefa 4: Consultas por período

**Arquivos:**
- Modificar: `src/lib/visita/repositorio.ts`
- Testar: `tests/visita/repositorio.test.ts` (acrescentar ao fim)

**Interfaces:**
- Consome: nada das tarefas anteriores.
- Produz:
  - `listarDoPeriodo(db: BancoVisita, opcoes: { de: string; ate: string; usuarioId?: string }): Promise<VisitaDoDia[]>`
  - `type ContagemDoDia = { data: string; aFazer: number; realizadas: number; reagendadas: number; canceladas: number }`
  - `contarPorDia(db: BancoVisita, opcoes: { de: string; ate: string; usuarioId?: string }): Promise<ContagemDoDia[]>`
  - `listarDoDia` mantém a assinatura de hoje: `(db, { data, usuarioId })`.

- [ ] **Passo 1: Escrever os testes que falham**

Acrescente ao fim de `tests/visita/repositorio.test.ts`, e inclua `listarDoPeriodo` e `contarPorDia` no `import` de `@/lib/visita/repositorio` no topo do arquivo:

```ts
describe('listarDoPeriodo', () => {
  it('inclui as duas bordas e nada fora delas', async () => {
    await criarVisita(banco.db, entrada({ data: '2026-08-23' }))
    await criarVisita(banco.db, entrada({ data: '2026-08-24' }))
    await criarVisita(banco.db, entrada({ data: '2026-08-30' }))
    await criarVisita(banco.db, entrada({ data: '2026-08-31' }))

    const semana = await listarDoPeriodo(banco.db, { de: '2026-08-24', ate: '2026-08-30' })

    expect(semana.map((v) => v.data)).toEqual(['2026-08-24', '2026-08-30'])
  })

  it('atravessa a virada de mês', async () => {
    await criarVisita(banco.db, entrada({ data: '2026-08-31' }))
    await criarVisita(banco.db, entrada({ data: '2026-09-01' }))

    const semana = await listarDoPeriodo(banco.db, { de: '2026-08-31', ate: '2026-09-06' })

    expect(semana).toHaveLength(2)
  })

  it('traz o nome do vendedor junto', async () => {
    await criarVisita(banco.db, entrada({ data: '2026-08-25' }))

    const [v] = await listarDoPeriodo(banco.db, { de: '2026-08-24', ate: '2026-08-30' })

    expect(v.vendedor).toBe('Vendedor de Teste')
  })

  it('sem usuarioId traz a equipe inteira; com usuarioId, só aquela pessoa', async () => {
    const outro = await criarOutroUsuario(banco.db, '44444444-4444-4444-4444-444444444444')
    await criarVisita(banco.db, entrada({ data: '2026-08-25' }))
    await criarVisita(
      banco.db,
      entrada({ data: '2026-08-25', usuarioId: outro.id, zapleUserId: outro.zapleUserId })
    )

    const todos = await listarDoPeriodo(banco.db, { de: '2026-08-24', ate: '2026-08-30' })
    const so = await listarDoPeriodo(banco.db, { de: '2026-08-24', ate: '2026-08-30', usuarioId })

    expect(todos).toHaveLength(2)
    expect(so).toHaveLength(1)
    expect(so[0].usuarioId).toBe(usuarioId)
  })

  it('devolve vazio quando não há visita no período, em vez de estourar', async () => {
    const vazio = await listarDoPeriodo(banco.db, { de: '2026-01-01', ate: '2026-01-07' })

    expect(vazio).toEqual([])
  })
})

describe('contarPorDia', () => {
  it('soma os quatro status por dia', async () => {
    const aFazer = await criarVisita(banco.db, entrada({ data: '2026-08-25' }))
    const feita = await criarVisita(banco.db, entrada({ data: '2026-08-25' }))
    const morta = await criarVisita(banco.db, entrada({ data: '2026-08-25' }))
    await mudarStatus(banco.db, feita.id, 'realizada', 'conversamos sobre o pedido novo')
    await mudarStatus(banco.db, morta.id, 'cancelada')
    expect(aFazer.status).toBe('a_fazer')

    const [dia] = await contarPorDia(banco.db, { de: '2026-08-24', ate: '2026-08-30' })

    expect(dia).toMatchObject({
      data: '2026-08-25',
      aFazer: 1,
      realizadas: 1,
      canceladas: 1,
      reagendadas: 0,
    })
  })

  it('conta o reagendamento nos dois dias: o que fechou e o que abriu', async () => {
    const v = await criarVisita(banco.db, entrada({ data: '2026-08-25' }))
    await reagendar(banco.db, v.id, '2026-08-28')

    const dias = await contarPorDia(banco.db, { de: '2026-08-24', ate: '2026-08-30' })

    expect(dias).toHaveLength(2)
    expect(dias[0]).toMatchObject({ data: '2026-08-25', reagendadas: 1, aFazer: 0 })
    expect(dias[1]).toMatchObject({ data: '2026-08-28', reagendadas: 0, aFazer: 1 })
  })

  it('omite o dia sem visita — quem monta a grade preenche com zero', async () => {
    await criarVisita(banco.db, entrada({ data: '2026-08-25' }))

    const dias = await contarPorDia(banco.db, { de: '2026-08-24', ate: '2026-08-30' })

    expect(dias.map((d) => d.data)).toEqual(['2026-08-25'])
  })

  it('devolve os dias em ordem cronológica', async () => {
    await criarVisita(banco.db, entrada({ data: '2026-08-28' }))
    await criarVisita(banco.db, entrada({ data: '2026-08-25' }))
    await criarVisita(banco.db, entrada({ data: '2026-08-30' }))

    const dias = await contarPorDia(banco.db, { de: '2026-08-24', ate: '2026-08-30' })

    expect(dias.map((d) => d.data)).toEqual(['2026-08-25', '2026-08-28', '2026-08-30'])
  })

  it('respeita o filtro de vendedor', async () => {
    const outro = await criarOutroUsuario(banco.db, '55555555-5555-5555-5555-555555555555')
    await criarVisita(banco.db, entrada({ data: '2026-08-25' }))
    await criarVisita(
      banco.db,
      entrada({ data: '2026-08-25', usuarioId: outro.id, zapleUserId: outro.zapleUserId })
    )

    const [dia] = await contarPorDia(banco.db, { de: '2026-08-24', ate: '2026-08-30', usuarioId })

    expect(dia.aFazer).toBe(1)
  })
})
```

- [ ] **Passo 2: Rodar e confirmar que falha**

```
npx vitest run tests/visita/repositorio.test.ts
```

Esperado: FAIL com `listarDoPeriodo is not a function` e `contarPorDia is not a function`. Os testes que já existiam no arquivo continuam passando.

- [ ] **Passo 3: Implementar**

Em `src/lib/visita/repositorio.ts`, acrescente `sql` ao import do `drizzle-orm` (hoje a linha não o traz):

```ts
import { and, asc, count, desc, eq, gt, gte, isNull, lte, ne, sql } from 'drizzle-orm'
```

Substitua a função `listarDoDia` inteira por este bloco:

```ts
/**
 * As visitas de um intervalo, com quem as leva.
 *
 * Sem `usuarioId` a consulta não filtra por vendedor: é o "ver a equipe" do
 * gestor. Quem chama decide, porque só a rota conhece o papel de quem pediu.
 *
 * O join traz o nome do vendedor junto porque na grade da semana o gestor
 * precisa saber de quem é cada visita, e uma consulta por linha para
 * descobrir isso seria lenta e desnecessária.
 */
export async function listarDoPeriodo(
  db: BancoVisita,
  opcoes: { de: string; ate: string; usuarioId?: string }
): Promise<VisitaDoDia[]> {
  const filtros = [gte(visita.data, opcoes.de), lte(visita.data, opcoes.ate)]
  if (opcoes.usuarioId) filtros.push(eq(visita.usuarioId, opcoes.usuarioId))

  const linhas = await db
    .select({ visita, vendedor: usuario.nome })
    .from(visita)
    .innerJoin(usuario, eq(usuario.id, visita.usuarioId))
    .where(and(...filtros))
    .orderBy(asc(visita.data), asc(visita.criadaEm))

  return linhas.map((l) => ({ ...l.visita, vendedor: l.vendedor }))
}

/**
 * Um dia é um intervalo de um dia só.
 *
 * Manter as duas consultas separadas — uma com `eq`, outra com `gte`/`lte` —
 * garantiria que uma correção futura entrasse em uma e não na outra.
 */
export async function listarDoDia(
  db: BancoVisita,
  opcoes: { data: string; usuarioId?: string }
): Promise<VisitaDoDia[]> {
  return listarDoPeriodo(db, { de: opcoes.data, ate: opcoes.data, usuarioId: opcoes.usuarioId })
}
```

E acrescente ao fim do arquivo:

```ts
export type ContagemDoDia = {
  data: string
  aFazer: number
  realizadas: number
  reagendadas: number
  canceladas: number
}

/**
 * Quantas visitas de cada status em cada dia do intervalo.
 *
 * A grade do mês precisa de quatro números por célula, não das visitas. Um
 * mês cheio de uma equipe pequena passa de 300 linhas com relato, descrição e
 * nome de cliente — trazer tudo isso para desenhar bolinha é trabalho jogado
 * fora. Agregado, são no máximo 31 linhas de cinco inteiros.
 *
 * Devolve só os dias que tiveram visita. Quem monta a grade preenche os
 * vazios com zero, como `serieDiaria` faz em `relatorios.ts`: um dia sem
 * visita é informação, e sumir com ele da tela esconderia justamente o buraco
 * que a visão de mês existe para mostrar.
 */
export async function contarPorDia(
  db: BancoVisita,
  opcoes: { de: string; ate: string; usuarioId?: string }
): Promise<ContagemDoDia[]> {
  const filtros = [gte(visita.data, opcoes.de), lte(visita.data, opcoes.ate)]
  if (opcoes.usuarioId) filtros.push(eq(visita.usuarioId, opcoes.usuarioId))

  const linhas = await db
    .select({
      data: visita.data,
      aFazer: count(sql`case when ${visita.status} = 'a_fazer' then 1 end`),
      realizadas: count(sql`case when ${visita.status} = 'realizada' then 1 end`),
      reagendadas: count(sql`case when ${visita.status} = 'reagendada' then 1 end`),
      canceladas: count(sql`case when ${visita.status} = 'cancelada' then 1 end`),
    })
    .from(visita)
    .where(and(...filtros))
    .groupBy(visita.data)

  return linhas.sort((a, b) => a.data.localeCompare(b.data))
}
```

- [ ] **Passo 4: Rodar os testes e confirmar que passam**

```
npx vitest run tests/visita/repositorio.test.ts
npx tsc --noEmit
```

Esperado: PASS em tudo, incluindo os testes antigos de `listarDoDia` — é a prova de que virar casca não mudou o comportamento.

- [ ] **Passo 5: Commitar**

```
git add src/lib/visita/repositorio.ts tests/visita/repositorio.test.ts
git commit -m "feat(visita): consultar visitas e contagens por intervalo"
```

---

## Tarefa 5: Agenda com abas e visão de semana

**Arquivos:**
- Criar: `src/lib/visita/agenda.ts`
- Criar: `src/app/(app)/agenda/GradeDaSemana.tsx`
- Modificar: `src/app/(app)/agenda/page.tsx`
- Testar: `tests/visita/agenda.test.ts` (novo)

**Interfaces:**
- Consome: `inicioDaSemana`, `inicioDoMes`, `fimDoMes`, `somarDias` (Tarefa 1); `listarDoPeriodo` (Tarefa 4).
- Produz:
  - `VISTAS: readonly ['dia', 'semana', 'mes']` e `type Vista = 'dia' | 'semana' | 'mes'`
  - `vistaValida(v: unknown): Vista`
  - `intervaloDaVista(vista: Vista, data: string): { de: string; ate: string }`
  - `passoDaVista(vista: Vista, data: string, direcao: 1 | -1): string`
  - `GradeDaSemana` (componente de servidor)

- [ ] **Passo 1: Escrever os testes que falham**

Crie `tests/visita/agenda.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { vistaValida, intervaloDaVista, passoDaVista } from '@/lib/visita/agenda'

describe('vistaValida', () => {
  it('aceita as três visões conhecidas', () => {
    expect(vistaValida('dia')).toBe('dia')
    expect(vistaValida('semana')).toBe('semana')
    expect(vistaValida('mes')).toBe('mes')
  })

  it('cai no dia diante de qualquer outra coisa', () => {
    // A visão do vendedor em campo é o dia; é ela que tem as ações.
    expect(vistaValida('ano')).toBe('dia')
    expect(vistaValida(undefined)).toBe('dia')
    expect(vistaValida(['semana'])).toBe('dia')
  })
})

describe('intervaloDaVista', () => {
  it('no dia, é o próprio dia nas duas pontas', () => {
    expect(intervaloDaVista('dia', '2026-08-27')).toEqual({ de: '2026-08-27', ate: '2026-08-27' })
  })

  it('na semana, vai de segunda a domingo', () => {
    // 27/08/2026 é quinta.
    expect(intervaloDaVista('semana', '2026-08-27')).toEqual({
      de: '2026-08-24',
      ate: '2026-08-30',
    })
  })

  it('no mês, cobre as 42 células da grade, não só o mês', () => {
    // Agosto/2026 começa num sábado: a grade abre em 27/07 e fecha em 06/09.
    // Consultar só 01/08–31/08 deixaria as vizinhas sempre em branco,
    // mentindo que aquela sexta da virada está livre.
    expect(intervaloDaVista('mes', '2026-08-27')).toEqual({ de: '2026-07-27', ate: '2026-09-06' })
  })

  it('no mês, o intervalo não depende de qual dia do mês veio', () => {
    expect(intervaloDaVista('mes', '2026-08-01')).toEqual(intervaloDaVista('mes', '2026-08-31'))
  })
})

describe('passoDaVista', () => {
  it('anda um dia por vez na visão de dia', () => {
    expect(passoDaVista('dia', '2026-08-27', 1)).toBe('2026-08-28')
    expect(passoDaVista('dia', '2026-08-27', -1)).toBe('2026-08-26')
  })

  it('anda sete dias por vez na semana', () => {
    expect(passoDaVista('semana', '2026-08-27', 1)).toBe('2026-09-03')
    expect(passoDaVista('semana', '2026-08-27', -1)).toBe('2026-08-20')
  })

  it('anda de mês em mês pelo dia 1, sem escorregar', () => {
    // Somar 30 ou 31 dias faria 31/01 virar 02/03 ou 03/03. Andar pelo
    // primeiro dia do mês é a única conta que não escorrega.
    expect(passoDaVista('mes', '2026-08-27', 1)).toBe('2026-09-01')
    expect(passoDaVista('mes', '2026-08-27', -1)).toBe('2026-07-01')
    expect(passoDaVista('mes', '2026-01-31', 1)).toBe('2026-02-01')
    expect(passoDaVista('mes', '2026-03-31', -1)).toBe('2026-02-01')
  })

  it('atravessa a virada de ano nos dois sentidos', () => {
    expect(passoDaVista('mes', '2026-12-15', 1)).toBe('2027-01-01')
    expect(passoDaVista('mes', '2026-01-15', -1)).toBe('2025-12-01')
  })
})
```

- [ ] **Passo 2: Rodar e confirmar que falha**

```
npx vitest run tests/visita/agenda.test.ts
```

Esperado: FAIL com `Failed to resolve import "@/lib/visita/agenda"`.

- [ ] **Passo 3: Implementar a lógica de calendário**

Crie `src/lib/visita/agenda.ts`:

```ts
import { fimDoMes, inicioDaSemana, inicioDoMes, somarDias } from './datas'

export const VISTAS = ['dia', 'semana', 'mes'] as const

export type Vista = (typeof VISTAS)[number]

/**
 * A visão pedida na URL, ou o dia.
 *
 * O dia é o padrão porque é a visão do vendedor em campo, e é a única que
 * tem as ações de fechar visita. Uma `?vista=` desconhecida cai nela em vez
 * de quebrar a tela.
 */
export function vistaValida(v: unknown): Vista {
  return typeof v === 'string' && (VISTAS as readonly string[]).includes(v) ? (v as Vista) : 'dia'
}

/**
 * O intervalo que cada visão precisa consultar.
 *
 * No mês são as 42 células da grade, não os 31 dias: a grade sempre mostra o
 * fim do mês anterior e o começo do seguinte, e consultar só o mês deixaria
 * essas células vazias por construção — mentindo que a sexta-feira da virada
 * está livre bem no lugar onde mora metade do planejamento.
 */
export function intervaloDaVista(vista: Vista, data: string): { de: string; ate: string } {
  if (vista === 'semana') {
    const de = inicioDaSemana(data)
    return { de, ate: somarDias(de, 6) }
  }
  if (vista === 'mes') {
    const de = inicioDaSemana(inicioDoMes(data))
    return { de, ate: somarDias(de, 41) }
  }
  return { de: data, ate: data }
}

/**
 * Para onde as setas ‹ › levam, conforme a visão.
 *
 * O mês anda pelo dia 1 de propósito. Somar 30 ou 31 dias faria 31/01 virar
 * 02/03 — o mês de fevereiro sumiria da navegação e ninguém entenderia por
 * quê.
 */
export function passoDaVista(vista: Vista, data: string, direcao: 1 | -1): string {
  if (vista === 'semana') return somarDias(data, 7 * direcao)
  if (vista === 'mes') {
    const primeiro = inicioDoMes(data)
    return direcao === 1
      ? somarDias(fimDoMes(primeiro), 1)
      : inicioDoMes(somarDias(primeiro, -1))
  }
  return somarDias(data, direcao)
}
```

- [ ] **Passo 4: Rodar os testes e confirmar que passam**

```
npx vitest run tests/visita/agenda.test.ts
```

Esperado: PASS, 11 casos.

- [ ] **Passo 5: Commitar a lógica antes de mexer em tela**

```
git add src/lib/visita/agenda.ts tests/visita/agenda.test.ts
git commit -m "feat(agenda): intervalo e navegação de cada visão"
```

- [ ] **Passo 6: Criar a grade da semana**

Crie `src/app/(app)/agenda/GradeDaSemana.tsx`. **Sem `'use client'`** — é componente de servidor, só links.

```tsx
import Link from 'next/link'
import type { VisitaDoDia } from '@/lib/visita/repositorio'
import { rotuloDoTipo } from '@/lib/visita/tipos'

/**
 * A semana inteira numa tela.
 *
 * Ela não fecha visita: tocar num card abre a visita, tocar no dia abre o
 * dia. As ações de status vivem num lugar só, o `ListaDoDia`, e espalhá-las
 * por mais telas garantiria que uma correção futura entrasse em uma e não
 * nas outras.
 *
 * A grade de sete colunas e a lista do celular renderizam os mesmos dados e
 * se alternam por CSS, não por JavaScript: detectar largura no cliente causa
 * um salto visível no primeiro render, como `Navegacao.tsx` já documenta.
 */

const FAIXA: Record<string, string> = {
  a_fazer: 'bg-fazer',
  realizada: 'bg-feita',
  reagendada: 'bg-adiada',
  cancelada: 'bg-morta',
}

const CURTOS = ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom']

export function GradeDaSemana({
  dias,
  visitas,
  hojeISO,
  mostrarVendedor,
  linkDoDia,
}: {
  dias: string[]
  visitas: VisitaDoDia[]
  hojeISO: string
  mostrarVendedor: boolean
  linkDoDia: (data: string) => string
}) {
  const porDia = new Map<string, VisitaDoDia[]>(dias.map((d) => [d, []]))
  for (const v of visitas) porDia.get(v.data)?.push(v)

  return (
    <>
      <div className="hidden grid-cols-7 items-start gap-2 lg:grid">
        {dias.map((d, i) => {
          const doDia = porDia.get(d) ?? []
          return (
            <div key={d} className="flex flex-col gap-1.5">
              <Cabecalho
                href={linkDoDia(d)}
                curto={CURTOS[i]}
                numero={Number(d.slice(8, 10))}
                n={doDia.length}
                ehHoje={d === hojeISO}
              />
              {doDia.map((v) => (
                <Card key={v.id} v={v} mostrarVendedor={mostrarVendedor} />
              ))}
            </div>
          )
        })}
      </div>

      {/* No celular, sete colunas dariam menos de 50px cada e o nome do
          cliente viraria uma letra por linha. A mesma leitura vira lista. */}
      <div className="flex flex-col gap-4 lg:hidden">
        {dias.map((d, i) => {
          const doDia = porDia.get(d) ?? []
          return (
            <section key={d} className="flex flex-col gap-1.5">
              <Cabecalho
                href={linkDoDia(d)}
                curto={CURTOS[i]}
                numero={Number(d.slice(8, 10))}
                n={doDia.length}
                ehHoje={d === hojeISO}
              />
              {doDia.length === 0 ? (
                <p className="px-1 text-sm text-slate-400">Nada agendado.</p>
              ) : (
                doDia.map((v) => <Card key={v.id} v={v} mostrarVendedor={mostrarVendedor} />)
              )}
            </section>
          )
        })}
      </div>
    </>
  )
}

function Cabecalho({
  href,
  curto,
  numero,
  n,
  ehHoje,
}: {
  href: string
  curto: string
  numero: number
  n: number
  ehHoje: boolean
}) {
  return (
    <Link
      href={href}
      className={`flex items-baseline justify-between rounded-xl px-2.5 py-2 transition-colors ${
        ehHoje ? 'bg-asfalto text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200'
      }`}
    >
      <span className="text-xs font-bold uppercase tracking-wide">{curto}</span>
      <span className="font-display text-lg font-semibold">{numero}</span>
      <span className={`text-xs ${ehHoje ? 'text-white/60' : 'text-slate-400'}`}>{n || '—'}</span>
    </Link>
  )
}

function Card({ v, mostrarVendedor }: { v: VisitaDoDia; mostrarVendedor: boolean }) {
  return (
    <Link
      href={`/visita/${v.id}`}
      className="flex overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200/70"
    >
      <div className={`w-1.5 shrink-0 ${FAIXA[v.status] ?? 'bg-morta'}`} aria-hidden="true" />
      <div className="min-w-0 flex-1 px-2.5 py-2">
        <p className="truncate font-display text-sm font-semibold">{v.contatoNome}</p>
        <p className="truncate text-xs text-slate-500">
          {rotuloDoTipo(v.tipo)}
          {mostrarVendedor && ` · ${v.vendedor.split(' ')[0]}`}
        </p>
      </div>
    </Link>
  )
}
```

- [ ] **Passo 7: Reescrever a página da agenda**

Substitua `src/app/(app)/agenda/page.tsx` inteiro:

```tsx
import Link from 'next/link'
import { exigirUsuario } from '@/lib/auth/atual'
import { listarDoPeriodo, db } from '@/lib/visita/repositorio'
import { hoje, diasEntre } from '@/lib/visita/datas'
import { VISTAS, vistaValida, intervaloDaVista, passoDaVista, type Vista } from '@/lib/visita/agenda'
import { ListaDoDia } from './ListaDoDia'
import { GradeDaSemana } from './GradeDaSemana'

export const dynamic = 'force-dynamic'

const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']
const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
]

const ROTULO_DA_VISTA: Record<Vista, string> = { dia: 'Dia', semana: 'Semana', mes: 'Mês' }

/** Nome do dia sem passar por fuso: a data já é só uma data. */
function porExtenso(data: string): { diaSemana: string; diaMes: string } {
  const [ano, mes, dia] = data.split('-').map(Number)
  const d = new Date(Date.UTC(ano, mes - 1, dia))
  return {
    diaSemana: DIAS[d.getUTCDay()],
    diaMes: `${dia} de ${MESES[mes - 1]}`,
  }
}

function nomeDoMes(data: string): string {
  return MESES[Number(data.slice(5, 7)) - 1]
}

/** "24 a 30 de agosto", ou "31 de agosto a 6 de setembro" quando vira o mês. */
function faixaDaSemana(de: string, ate: string): string {
  const d1 = Number(de.slice(8, 10))
  const d2 = Number(ate.slice(8, 10))
  if (de.slice(0, 7) === ate.slice(0, 7)) return `${d1} a ${d2} de ${nomeDoMes(de)}`
  return `${d1} de ${nomeDoMes(de)} a ${d2} de ${nomeDoMes(ate)}`
}

export default async function Agenda({ searchParams }: PageProps<'/agenda'>) {
  const u = await exigirUsuario()
  const { data, todos, vista } = await searchParams

  // hoje() usa o fuso de São Paulo — new Date().toISOString() viraria o dia
  // às 21h no Brasil e a agenda apareceria vazia bem na hora em que o
  // vendedor está fechando o dia.
  const hojeISO = hoje()
  const dia = typeof data === 'string' ? data : hojeISO
  const v = vistaValida(vista)
  const vendoTodos = todos === '1' && u.papel === 'gestor'
  const { de, ate } = intervaloDaVista(v, dia)

  const visitas = await listarDoPeriodo(db, { de, ate, usuarioId: vendoTodos ? undefined : u.id })

  const aFazer = visitas.filter((x) => x.status === 'a_fazer').length
  const fechadas = visitas.length - aFazer
  const progresso = visitas.length === 0 ? 0 : Math.round((fechadas / visitas.length) * 100)
  const { diaSemana, diaMes } = porExtenso(dia)
  const ehHoje = dia === hojeISO

  /**
   * Um construtor de link para a tela inteira.
   *
   * Trocar de aba não pode perder o dia que a pessoa estava olhando, nem o
   * "ver a equipe" do gestor. Os valores padrão saem da URL para o link de
   * hoje na visão de dia ficar sendo `/agenda` limpo.
   */
  const link = (troca: { data?: string; vista?: Vista; todos?: boolean } = {}) => {
    const d = troca.data ?? dia
    const vi = troca.vista ?? v
    const t = troca.todos ?? vendoTodos
    const p = new URLSearchParams()
    if (d !== hojeISO) p.set('data', d)
    if (vi !== 'dia') p.set('vista', vi)
    if (t) p.set('todos', '1')
    const q = p.toString()
    return q ? `/agenda?${q}` : '/agenda'
  }

  const titulo =
    v === 'dia' ? diaMes : v === 'semana' ? faixaDaSemana(de, ate) : `${nomeDoMes(dia)} de ${dia.slice(0, 4)}`

  const chapeu =
    v === 'dia' ? (ehHoje ? 'Hoje' : diaSemana) : v === 'semana' ? 'Semana' : 'Mês'

  return (
    <div className="flex flex-col gap-5">
      {/* O cabeçalho responde de relance às duas perguntas de quem abre a
          agenda: que período é este, e quanto dele já foi fechado. */}
      <section className="overflow-hidden rounded-2xl bg-asfalto text-white shadow-sm">
        <div className="flex items-start justify-between gap-3 px-5 pt-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/50">
              {chapeu}
            </p>
            <h1 className="font-display text-3xl font-semibold leading-tight">{titulo}</h1>
          </div>

          <div className="flex items-center gap-1.5">
            <Link
              href={link({ data: passoDaVista(v, dia, -1) })}
              aria-label="Período anterior"
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-lg text-white/80 transition-colors hover:bg-white/20"
            >
              ‹
            </Link>
            <Link
              href={link({ data: passoDaVista(v, dia, 1) })}
              aria-label="Período seguinte"
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-lg text-white/80 transition-colors hover:bg-white/20"
            >
              ›
            </Link>
          </div>
        </div>

        <div className="flex gap-1 px-5 pt-3" role="tablist" aria-label="Visão da agenda">
          {VISTAS.map((opcao) => (
            <Link
              key={opcao}
              href={link({ vista: opcao })}
              aria-current={opcao === v ? 'page' : undefined}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
                opcao === v ? 'bg-white text-asfalto' : 'bg-white/10 text-white/70 hover:bg-white/20'
              }`}
            >
              {ROTULO_DA_VISTA[opcao]}
            </Link>
          ))}
        </div>

        <div className="flex items-baseline gap-2 px-5 pt-3">
          <span className="font-display text-2xl font-semibold">{fechadas}</span>
          <span className="text-sm text-white/60">
            de {visitas.length} {visitas.length === 1 ? 'visita' : 'visitas'}
          </span>
          {aFazer > 0 && (
            <span className="ml-auto text-sm font-medium text-white/80">
              {aFazer} {aFazer === 1 ? 'restante' : 'restantes'}
            </span>
          )}
        </div>

        {/* A barra do período. É o instrumento: uma olhada diz quanto já foi
            fechado, sem contar card nenhum. */}
        <div className="mt-3 h-1.5 w-full bg-white/10">
          <div
            className="h-full bg-feita transition-[width] duration-500"
            style={{ width: `${progresso}%` }}
          />
        </div>

        <div className="flex items-center gap-4 px-5 py-3 text-sm">
          {!ehHoje && (
            <Link href={link({ data: hojeISO })} className="text-white/70 underline-offset-4 hover:underline">
              Voltar para hoje
            </Link>
          )}
          {u.papel === 'gestor' && (
            <Link
              href={link({ todos: !vendoTodos })}
              className="ml-auto rounded-lg bg-white/10 px-3 py-1.5 font-medium text-white/90 transition-colors hover:bg-white/20"
            >
              {vendoTodos ? 'Só as minhas' : 'Ver a equipe'}
            </Link>
          )}
        </div>
      </section>

      {v === 'dia' && <ListaDoDia visitas={visitas} mostrarVendedor={vendoTodos} />}

      {v === 'semana' && (
        <GradeDaSemana
          dias={diasEntre(de, ate)}
          visitas={visitas}
          hojeISO={hojeISO}
          mostrarVendedor={vendoTodos}
          linkDoDia={(d) => link({ data: d, vista: 'dia' })}
        />
      )}
    </div>
  )
}
```

- [ ] **Passo 8: Verificar tipos e build**

```
npx tsc --noEmit
npm test
```

Esperado: nenhuma saída do `tsc`, suíte inteira PASS. `npm test` aqui é para confirmar que trocar `listarDoDia` por `listarDoPeriodo` na página não quebrou nada a montante.

- [ ] **Passo 9: Conferir na tela**

```
npm run dev
```

Abra `/agenda` e confirme:

1. Abre no dia, exatamente como antes, com as ações funcionando.
2. Clicar em "Semana" mostra as sete colunas no notebook; o título vira "24 a 30 de agosto"; o dia de hoje está destacado.
3. Estreitar a janela abaixo de `lg` troca a grade pela lista agrupada por dia, sem recarregar.
4. As setas ‹ › andam de semana em semana quando a aba é Semana.
5. Como gestor, "Ver a equipe" continua ligado ao trocar de aba, e o primeiro nome do vendedor aparece nos cards.
6. Clicar no cabeçalho de um dia da semana abre aquele dia com as ações.
7. `?vista=abacaxi` abre no dia, sem erro.

- [ ] **Passo 10: Commitar**

```
git add "src/app/(app)/agenda/page.tsx" "src/app/(app)/agenda/GradeDaSemana.tsx"
git commit -m "feat(agenda): abas de visão e grade da semana"
```

---

## Tarefa 6: Visão de mês

**Arquivos:**
- Criar: `src/app/(app)/agenda/GradeDoMes.tsx`
- Modificar: `src/app/(app)/agenda/page.tsx`

**Interfaces:**
- Consome: `contarPorDia` e `ContagemDoDia` (Tarefa 4); `intervaloDaVista` (Tarefa 5); `diasEntre` (Tarefa 1).
- Produz: nada. É a última tarefa.

- [ ] **Passo 1: Criar a grade do mês**

Crie `src/app/(app)/agenda/GradeDoMes.tsx`. **Sem `'use client'`**.

```tsx
import Link from 'next/link'
import type { ContagemDoDia } from '@/lib/visita/repositorio'

/**
 * O mês inteiro em contadores.
 *
 * Não carrega as visitas de propósito: um mês cheio de uma equipe pequena
 * passa de 300 linhas, e o que a célula mostra são quatro números. A conta
 * vem agregada do banco.
 *
 * As células das pontas são os dias do mês vizinho, em cinza e igualmente
 * clicáveis — a última semana de julho aparece na tela de agosto, e é ali
 * que mora metade do planejamento da virada.
 */

const CURTOS = ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom']

const PONTOS = [
  { chave: 'aFazer', cor: 'bg-fazer', rotulo: 'a fazer' },
  { chave: 'realizadas', cor: 'bg-feita', rotulo: 'realizadas' },
  { chave: 'reagendadas', cor: 'bg-adiada', rotulo: 'reagendadas' },
  { chave: 'canceladas', cor: 'bg-morta', rotulo: 'canceladas' },
] as const

export function GradeDoMes({
  dias,
  mesCorrente,
  contagens,
  hojeISO,
  linkDoDia,
}: {
  dias: string[]
  /** 'AAAA-MM' do mês que a tela está mostrando. */
  mesCorrente: string
  contagens: ContagemDoDia[]
  hojeISO: string
  linkDoDia: (data: string) => string
}) {
  // O banco só devolve dias que tiveram visita; os outros entram com zero.
  // Um dia vazio é informação — é justamente o buraco que esta visão existe
  // para mostrar.
  const porDia = new Map(contagens.map((c) => [c.data, c]))

  return (
    <div className="overflow-hidden rounded-2xl bg-white p-2 shadow-sm ring-1 ring-slate-200/70">
      <div className="grid grid-cols-7">
        {CURTOS.map((c) => (
          <div
            key={c}
            className="pb-1 text-center text-xs font-bold uppercase tracking-wide text-slate-400"
          >
            {c}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {dias.map((d) => {
          const c = porDia.get(d)
          const total = c ? c.aFazer + c.realizadas + c.reagendadas + c.canceladas : 0
          const doMes = d.slice(0, 7) === mesCorrente
          const ehHoje = d === hojeISO

          return (
            <Link
              key={d}
              href={linkDoDia(d)}
              aria-label={`${Number(d.slice(8, 10))} — ${total} ${total === 1 ? 'visita' : 'visitas'}`}
              // Altura fixa: sem ela a grade pularia de tamanho ao trocar de
              // mês, conforme os dias cheios caíssem em linhas diferentes.
              className={`flex h-20 flex-col rounded-xl p-1.5 transition-colors ${
                ehHoje
                  ? 'bg-asfalto text-white'
                  : doMes
                    ? 'bg-slate-50 hover:bg-slate-100'
                    : 'bg-white text-slate-300 hover:bg-slate-50'
              }`}
            >
              <span
                className={`text-sm font-semibold ${
                  ehHoje ? 'text-white' : doMes ? 'text-slate-600' : 'text-slate-300'
                }`}
              >
                {Number(d.slice(8, 10))}
              </span>

              {total > 0 && (
                <span className="mt-auto flex flex-wrap gap-0.5">
                  {PONTOS.map((p) =>
                    Array.from({ length: Math.min(c![p.chave], 6) }, (_, i) => (
                      <span
                        key={`${p.chave}-${i}`}
                        title={p.rotulo}
                        className={`h-1.5 w-1.5 rounded-full ${p.cor}`}
                      />
                    ))
                  )}
                  {total > 6 && (
                    <span className={`text-[10px] ${ehHoje ? 'text-white/70' : 'text-slate-400'}`}>
                      {total}
                    </span>
                  )}
                </span>
              )}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Passo 2: Ligar o mês na página**

Em `src/app/(app)/agenda/page.tsx`:

Troque a linha de import do repositório e acrescente a do componente:

```tsx
import { listarDoPeriodo, contarPorDia, db } from '@/lib/visita/repositorio'
import { GradeDoMes } from './GradeDoMes'
```

Troque a busca de dados. O que a Tarefa 5 deixou como:

```tsx
  const visitas = await listarDoPeriodo(db, { de, ate, usuarioId: vendoTodos ? undefined : u.id })

  const aFazer = visitas.filter((x) => x.status === 'a_fazer').length
  const fechadas = visitas.length - aFazer
  const progresso = visitas.length === 0 ? 0 : Math.round((fechadas / visitas.length) * 100)
```

passa a ser:

```tsx
  const usuarioId = vendoTodos ? undefined : u.id

  // O mês lê contagens, não visitas: são 42 células de quatro números, e
  // trazer 300 linhas com relato e nome de cliente para desenhar bolinha
  // seria trabalho jogado fora.
  const visitas = v === 'mes' ? [] : await listarDoPeriodo(db, { de, ate, usuarioId })
  const contagens = v === 'mes' ? await contarPorDia(db, { de, ate, usuarioId }) : []

  const total =
    v === 'mes'
      ? contagens.reduce((n, c) => n + c.aFazer + c.realizadas + c.reagendadas + c.canceladas, 0)
      : visitas.length
  const aFazer =
    v === 'mes'
      ? contagens.reduce((n, c) => n + c.aFazer, 0)
      : visitas.filter((x) => x.status === 'a_fazer').length
  const fechadas = total - aFazer
  const progresso = total === 0 ? 0 : Math.round((fechadas / total) * 100)
```

No cabeçalho, troque as duas ocorrências de `visitas.length` pelo `total`:

```tsx
          <span className="text-sm text-white/60">
            de {total} {total === 1 ? 'visita' : 'visitas'}
          </span>
```

E acrescente o bloco da grade do mês depois do bloco da semana:

```tsx
      {v === 'mes' && (
        <GradeDoMes
          dias={diasEntre(de, ate)}
          mesCorrente={dia.slice(0, 7)}
          contagens={contagens}
          hojeISO={hojeISO}
          linkDoDia={(d) => link({ data: d, vista: 'dia' })}
        />
      )}
```

Remova `formatarDia` do import de `datas` se ele continuar sem uso.

- [ ] **Passo 3: Verificar tipos e rodar a suíte**

```
npx tsc --noEmit
npm test
```

Esperado: nenhuma saída do `tsc`, suíte inteira PASS.

- [ ] **Passo 4: Conferir na tela**

```
npm run dev
```

Em `/agenda`, aba Mês:

1. A grade tem 6 linhas de 7, sempre — o tamanho não muda ao navegar entre meses.
2. Os dias de julho e setembro aparecem em cinza claro e **são clicáveis**.
3. Um dia com visitas mostra as bolinhas nas cores dos status; um dia vazio mostra só o número.
4. Hoje está destacado.
5. As setas ‹ › andam de mês em mês. Vá até fevereiro e volte: nenhum mês é pulado.
6. Clicar numa célula abre aquele dia com as ações.
7. Como gestor, "Ver a equipe" muda os contadores.
8. O contador do cabeçalho ("N de M visitas") bate com a soma das bolinhas do mês.

- [ ] **Passo 5: Rodar o build de produção**

```
npm run build
```

Esperado: build concluído sem erro. É o que pega problema de RSC que o `tsc` sozinho não vê.

- [ ] **Passo 6: Commitar**

```
git add "src/app/(app)/agenda/page.tsx" "src/app/(app)/agenda/GradeDoMes.tsx"
git commit -m "feat(agenda): visão de mês com contadores por dia"
```

---

## Cobertura da spec

| Seção da spec | Onde é implementada |
|---|---|
| 3 — fundação de datas | Tarefa 1 |
| 4.1 — `listarDoPeriodo`, `listarDoDia` casca, `contarPorDia` | Tarefa 4 |
| 4.2 — `intervaloDoFiltro` | Tarefa 2 |
| 5 — rota `?vista=`, intervalos das visões | Tarefa 5, passos 3 e 7 |
| 5.1 — cabeçalho com abas, setas, título, progresso | Tarefa 5, passo 7 |
| 5.2 — grade no notebook, lista no celular | Tarefa 5, passo 6 |
| 5.3 — navegação por toque, células vazias clicáveis, grade 6×7 | Tarefa 5 passo 6, Tarefa 6 passo 1 |
| 6 — atalhos, formulário de range, `comFiltros` | Tarefa 3, passo 3 |
| 6.1 — status no CSV, subtítulo dos alertas | Tarefa 3, passos 3 e 4 |
| 7 — testes | Tarefas 1–5, sempre no primeiro passo |
| 8 — arquivos tocados | tabela de estrutura no topo |

**Divergências registradas** (as duas em `intervaloDoFiltro`, as duas fixadas por teste):

1. A spec (4.2, regra 2) diz que só `de` completa com `ate = hojeISO`. Quando o `de` está no futuro, `ate` recebe o próprio `de` — completar com hoje deixaria o intervalo invertido. Teste: "mostra só aquele dia quando o de está no futuro e não veio ate".
2. A spec (4.2, regra 3) diz que formato inválido cai para os últimos 30 dias. Na implementação, **só a metade inválida é descartada** e a outra continua valendo: `?de=2026-02-30&ate=2026-08-03` devolve 05/07 a 03/08, não os últimos 30 dias. Jogar fora o `ate` que o gestor digitou certo por causa do `de` que ele digitou errado seria pior que o erro dele. A queda para 30 dias fica para quando não sobra nada utilizável — as duas datas tortas, ou `de` depois de `ate`. Testes: "descarta a data que não existe no calendário e honra a outra" e "cai nos últimos 30 dias quando as duas datas são impossíveis".
