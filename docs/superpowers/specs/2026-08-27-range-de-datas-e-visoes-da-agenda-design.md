# Range de datas nos relatórios e visões da agenda — Design

**Data:** 2026-08-27
**Depende de:** [2026-08-25 — Inversão da fonte da verdade](2026-08-25-inversao-fonte-da-verdade-design.md)

Duas mudanças pedidas juntas, que compartilham a mesma fundação de datas:

1. **Relatórios com range livre de datas**, no lugar dos quatro períodos fixos.
2. **Agenda em dia, semana e mês**, no lugar da visão de um dia só.

Ambas são de leitura: nenhuma altera o modelo de dados, nenhuma escreve nada
novo, nenhuma toca no sincronismo com o Zaple.

---

## 1. O problema

**Relatórios.** Os períodos são quatro botões — 7, 30, 90 e 365 dias — e todos
terminam em `hoje()`. Isso responde "como estamos indo" e nada mais. Não
responde "feche agosto para mim", que é a pergunta do fim do mês, nem "o que
está marcado para setembro", porque o período nunca passa de hoje.

**Agenda.** A tela mostra um dia por vez, com setas ‹ ›. Para o vendedor em
campo é o recorte certo — ele trabalha o dia que está vivendo. Mas planejar a
semana exige sete toques e nenhuma visão do conjunto, e é justamente aí que
aparece o buraco: a quinta-feira vazia que ninguém enxergou porque nunca olhou
quinta e sexta na mesma tela.

---

## 2. Decisões

| # | Decisão | Alternativa descartada |
|---|---|---|
| 2.1 | Atalhos de período **e** range livre nos relatórios | só range livre; ou seletor de mês fechado |
| 2.2 | Semana em grade de 7 colunas, mês em calendário com contadores | listas agrupadas por dia; ou mês com todos os cards |
| 2.3 | Semana e mês são só de leitura | replicar realizar/reagendar nas três visões |
| 2.4 | Uma rota `/agenda` com `?vista=`, não rotas separadas | `/agenda/semana` e `/agenda/mes` |
| 2.5 | Formulário GET puro, sem JavaScript | componente cliente atualizando a URL |
| 2.6 | O mês carrega contagens agregadas, não visitas | carregar as visitas do mês e contar no cliente |
| 2.7 | Datas futuras são permitidas no filtro | continuar travando o fim do período em hoje |
| 2.8 | Os alertas continuam ancorados em hoje | recalcular os alertas para o período escolhido |

### 2.3 — Por que semana e mês não têm ações

A lógica de mudar status vive hoje num lugar só, o `ListaDoDia`, que é client
component e conhece os quatro fluxos (realizar com relato, reagendar, cancelar,
reabrir). Espalhá-la por mais duas telas garante que uma correção futura entre
em uma e não nas outras.

Há também o motivo físico: na grade da semana cada coluna tem cerca de 120px
num notebook, e o card não comporta botão de toque confortável. Tocar na visita
abre a visita; tocar no dia abre o dia, que é onde as ações já estão.

### 2.6 — Por que o mês conta no banco

Um mês cheio para uma equipe de cinco pessoas passa de 300 visitas. Trazer as
300 linhas com relato, descrição e nome do cliente para desenhar quatro
bolinhas por célula é trabalho jogado fora. `GROUP BY data` devolve no máximo
31 linhas de cinco inteiros. É o mesmo argumento que já sustenta
`resumoPorVendedor` em `repositorio.ts`.

### 2.7 — Por que permitir data futura

Hoje `ate` é sempre `hoje()`. Com isso, tudo que está agendado à frente é
invisível no relatório — o gestor consegue ver o que a equipe fez, nunca o que
a equipe vai fazer. `contarAgendadasAdiante` existe no repositório justamente
para contornar isso no painel, com um número solto. Com range livre a pergunta
"o que está marcado para setembro" passa a ter resposta direta.

### 2.8 — Por que os alertas ficam em hoje

"Visita atrasada" e "cliente sem visita há 30 dias" são perguntas sobre o
presente. Recalculá-las para um período de julho responderia o que estava
atrasado em julho — informação arqueológica que ninguém pediu e que o gestor
leria como se fosse a situação atual. Os outros dois alertas, "reagendados em
série" e "realizadas sem relato", seguem o período, porque são leituras do
intervalo. O bloco ganha um subtítulo dizendo qual é qual.

---

## 3. Fundação de datas

`src/lib/visita/datas.ts` ganha quatro funções. Todas operam em UTC, pelo
motivo que `somarDias` já documenta no arquivo: a data aqui é só uma data, e
aritmética em fuso local faz o dia escorregar em UTC-3.

| Função | Devolve |
|---|---|
| `inicioDaSemana(data)` | a segunda-feira daquela semana |
| `inicioDoMes(data)` | o dia 1 daquele mês |
| `fimDoMes(data)` | o último dia daquele mês |
| `diasEntre(de, ate)` | array de `'YYYY-MM-DD'`, inclusivo nas duas pontas |

A semana começa na segunda e termina no domingo: é a semana comercial de quem
vende, e alinhar a grade com o domingo colocaria o fim de semana no meio do
raciocínio de planejamento.

`diasEntre` é a peça compartilhada — a grade da semana, a grade do mês e o
preenchimento de dias vazios saem toda dela.

---

## 4. Consultas

### 4.1 `src/lib/visita/repositorio.ts`

**`listarDoPeriodo(db, { de, ate, usuarioId })` → `VisitaDoDia[]`**

As visitas do intervalo com o nome do vendedor, ordenadas por `data` e depois
por `criadaEm`. Sem `usuarioId` não filtra por vendedor — é o "ver a equipe" do
gestor, e quem chama decide, porque só a rota conhece o papel de quem pediu.
Mesma regra que `listarDoDia` já segue.

**`listarDoDia` vira uma casca sobre `listarDoPeriodo`** (`de === ate`). As duas
seriam a mesma consulta com `eq` no lugar de `gte`/`lte`; mantê-las separadas
garantiria que uma correção futura entrasse em uma só.

**`contarPorDia(db, { de, ate, usuarioId })` → `ContagemDoDia[]`**

```ts
type ContagemDoDia = {
  data: string
  aFazer: number
  realizadas: number
  reagendadas: number
  canceladas: number
}
```

`GROUP BY visita.data`, no mesmo formato dos contadores que `serieDiaria` já
produz em `relatorios.ts`. **Devolve só os dias que tiveram visita** — quem
monta a grade preenche os vazios com zero, como `serieDiaria` faz e pela mesma
razão: um dia sem visita é informação, não é buraco.

### 4.2 `src/lib/visita/periodo.ts` (novo)

```ts
type Intervalo = { de: string; ate: string; atalhoAtivo: number | null }

intervaloDoFiltro(
  params: { de?: string; ate?: string; periodo?: string },
  hojeISO: string
): Intervalo
```

Função pura, fora do componente, para ser testada sem renderizar nada e para a
tela e a rota do CSV lerem o período pela mesma regra — hoje cada uma faz essa
conta do seu jeito, e é assim que planilha e tela começam a discordar.

Regras:

1. `de` e `ate` válidos e em ordem → usa os dois.
2. Só `de` → `ate = hojeISO`. Só `ate` → `de = ate - 29 dias`.
3. Formato inválido, data impossível (`2026-02-30`) ou `de` depois de `ate` →
   cai para os últimos 30 dias. Sem erro na cara do gestor: uma URL torta não é
   motivo para uma tela quebrada.
4. Intervalo acima de **731 dias** → `de` é aparado para `ate - 731`. Protege
   contra uma URL digitada errada varrer a tabela inteira.
5. Nenhum dos dois, mas `periodo=N` presente → traduz para
   `{ de: hoje - N, ate: hoje }`. É a compatibilidade com os links antigos.
6. Nada → últimos 30 dias.
7. `atalhoAtivo` é o `dias` do atalho que bate exatamente com o intervalo
   resultante, ou `null` se for personalizado. É só o que a tela precisa para
   destacar o botão certo.

Datas futuras passam: a decisão 2.7.

---

## 5. A tela da agenda

`src/app/(app)/agenda/page.tsx` lê `vista` (`dia` | `semana` | `mes`, padrão
`dia`), valida contra os três valores conhecidos e escolhe o que buscar.

| Visão | Componente | Consulta | Conteúdo |
|---|---|---|---|
| Dia | `ListaDoDia` (existente, intocado) | `listarDoDia` | como é hoje, com as ações |
| Semana | `GradeDaSemana` (novo) | `listarDoPeriodo` | 7 colunas seg–dom, cards compactos |
| Mês | `GradeDoMes` (novo) | `contarPorDia` | calendário 6×7, contadores por status |

Os dois componentes novos são **de servidor**: não têm estado, só links. Isso
mantém as ações num lugar só (decisão 2.3) e evita mandar a lista de visitas
para o cliente.

O intervalo que cada visão consulta sai da fundação da seção 3:

- Semana: `inicioDaSemana(data)` até `+6` dias.
- Mês: `inicioDaSemana(inicioDoMes(data))` até `+41` dias — as 42 células da
  grade, não só o mês. Consultar apenas `inicioDoMes`–`fimDoMes` deixaria os
  dias vizinhos da grade sempre em branco, mentindo que estão livres.

### 5.1 Cabeçalho compartilhado

O bloco escuro no topo passa a servir as três visões:

- **Abas** Dia · Semana · Mês, que preservam `data` e `todos` na URL.
- **Setas ‹ ›** andam 1 dia, 1 semana ou 1 mês conforme a visão.
- **Título:** `25 de agosto` · `24 a 30 de agosto` · `agosto de 2026`.
- **Progresso** (fechadas / total) passa a medir o período inteiro, não o dia.
- **"Ver a equipe"** e **"Voltar para hoje"** continuam, atravessando as abas.

### 5.2 Comportamento no celular

A grade de 7 colunas não cabe num celular: cada coluna ficaria com menos de
50px e o nome do cliente viraria uma letra por linha. Abaixo de `lg`, a semana
vira **lista rolável agrupada por dia**, cada dia com seu cabeçalho e sua
contagem — a mesma leitura, sem espremer.

O mês é um calendário de números e cabe em qualquer largura; só encolhe.

A alternância é por CSS, não por JavaScript, pelo mesmo motivo que
`Navegacao.tsx` já documenta: detectar largura no cliente causa um salto
visível no primeiro render.

### 5.3 Navegação por toque

- Semana: card → `/visita/[id]`; cabeçalho do dia → `?data=…&vista=dia`.
- Mês: célula → `?data=…&vista=dia`.
- **Célula de dia vazio também é clicável.** É assim que se agenda numa lacuna
  que se acabou de enxergar — o buraco na quinta-feira só vira visita se der
  para tocar nele.
- O dia de hoje fica marcado nas duas grades.

A grade do mês é sempre 6×7. As células que sobram nas pontas são os dias do
mês anterior e do seguinte, em cinza e igualmente clicáveis: a última semana de
julho aparece na tela de agosto, e é ali que mora metade do planejamento da
virada. Altura fixa evita que a grade pule de tamanho ao trocar de mês.

---

## 6. A tela de relatórios

A URL passa a ser a fonte da verdade do período: `?de=2026-07-15&ate=2026-08-03`.

- Os botões 7/30/90 dias e 1 ano continuam, agora como **atalhos** que navegam
  para o `de`/`ate` já calculado. O destaque vem de `atalhoAtivo`.
- **Formulário de range:** `<form method="get">` com dois `<input type="date">`
  e um botão "Aplicar", mais dois `<input type="hidden">` carregando `vendedor`
  e `status` — trocar a data não pode apagar os filtros já escolhidos. Sem
  JavaScript, sem `useRouter`. O `type="date"` abre o calendário nativo do
  aparelho, que é melhor do que qualquer coisa que eu escreveria, e a tela
  continua 100% servidor.
- `comFiltros` passa a montar `de`/`ate` no lugar de `periodo`.
- O subtítulo `{formatarDia(de)} a {formatarDia(ate)}` já existe e continua.

### 6.1 Ajustes de coerência

**O botão "Baixar planilha do período" passa a levar o filtro de status.** Hoje
ele leva `de`, `ate` e `usuarioId`. O gestor filtra "Canceladas" na tela, baixa
a planilha, recebe tudo, e conclui que o download está quebrado.
`src/app/api/relatorios/csv/route.ts` passa a ler `status` e a usar
`intervaloDoFiltro` para interpretar as datas.

**O bloco "Precisa de atenção" ganha um subtítulo** dizendo que "atrasadas" e
"clientes sem visita" olham para hoje, e os outros dois para o período — a
decisão 2.8.

---

## 7. Testes

| Arquivo | Cobre |
|---|---|
| `tests/visita/datas.test.ts` | `inicioDaSemana` (inclusive quando a data já é segunda, e quando é domingo), `inicioDoMes`/`fimDoMes` (30, 31, fevereiro comum e bissexto), `diasEntre` (mesma data nas duas pontas, virada de mês, virada de ano) |
| `tests/visita/periodo.test.ts` (novo) | as sete regras da seção 4.2, incluindo `2026-02-30`, `de` > `ate`, intervalo de 5 anos aparado, `periodo=30` legado e data futura aceita |
| `tests/visita/repositorio.test.ts` | `listarDoPeriodo` com período atravessando virada de mês, com e sem `usuarioId`; `listarDoDia` continuando a passar depois de virar casca; `contarPorDia` somando os quatro status e omitindo dia sem visita |
| `tests/visita/relatorios.test.ts` (novo) | `listarParaAuditoria` respeitando as bordas: visita exatamente em `de` e em `ate` entram, um dia fora não |

Os testes de banco rodam contra o Postgres em memória já montado em
`tests/apoio/banco.ts`.

---

## 8. O que muda no código

| Arquivo | Mudança |
|---|---|
| `src/lib/visita/datas.ts` | + 4 funções |
| `src/lib/visita/periodo.ts` | novo |
| `src/lib/visita/repositorio.ts` | + `listarDoPeriodo`, + `contarPorDia`, `listarDoDia` vira casca |
| `src/app/(app)/agenda/page.tsx` | lê `vista`, escolhe a consulta, cabeçalho compartilhado |
| `src/app/(app)/agenda/GradeDaSemana.tsx` | novo |
| `src/app/(app)/agenda/GradeDoMes.tsx` | novo |
| `src/app/(app)/relatorios/page.tsx` | atalhos + formulário de range, `comFiltros`, subtítulo dos alertas |
| `src/app/api/relatorios/csv/route.ts` | usa `intervaloDoFiltro`, aceita `status` |

Sem dependência nova. Sem biblioteca de calendário: o que a grade precisa são
as quatro funções da seção 3.

Sem migração de banco. Nenhuma coluna nova, nenhum índice novo — as consultas
novas filtram por `visita.data`, que já é o filtro de `resumoPorVendedor` e
`serieDiaria`.

---

## 9. Fora de escopo

- Arrastar visita de um dia para outro na grade (o `@dnd-kit` está no projeto,
  mas reagendar tem regra própria: fecha uma linha e abre outra).
- Visão de agenda por vendedor lado a lado (uma coluna por pessoa).
- Horário na visita. A visita hoje tem data, não hora; a grade da semana ordena
  por criação, não por horário, e assume esse limite.
- Exportar a agenda para `.ics` ou Google Calendar.
- Salvar períodos favoritos do gestor.

---

## 10. Ordem de entrega

1. Fundação de datas (seção 3) com os testes — nada depende de tela.
2. `intervaloDoFiltro` (4.2) com os testes.
3. Relatórios: atalhos + range + CSV (seção 6). **Entrega fechada e usável.**
4. `listarDoPeriodo` + `contarPorDia` (4.1) com os testes.
5. Agenda: cabeçalho com abas + `GradeDaSemana`.
6. Agenda: `GradeDoMes`.

Os passos 1–3 entregam o primeiro pedido inteiro e podem ir para produção antes
de a agenda começar.
