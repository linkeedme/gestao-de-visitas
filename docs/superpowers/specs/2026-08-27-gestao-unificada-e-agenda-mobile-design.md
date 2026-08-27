# Gestão unificada e agenda no celular

**Data:** 2026-08-27
**Estado:** aprovado em conversa, pronto para plano de implementação

## O problema

### Duas páginas que são a mesma página

`/painel` e `/relatorios` nasceram separadas e cresceram uma para dentro da
outra. Hoje elas compartilham:

| Conteúdo | `/painel` | `/relatorios` |
|---|---|---|
| Alerta "clientes reagendados em série" | sim | sim |
| Alerta "clientes sem visita" | sim | sim |
| Números por pessoa | `resumoPorVendedor` | `kpisPorVendedor` |

Os dois primeiros são **o mesmo aviso mostrado duas vezes**, em telas
diferentes. O terceiro é a mesma pergunta respondida por duas consultas
diferentes — `kpisPorVendedor` devolve tudo o que `resumoPorVendedor` devolve,
mais `clientesAlcancados`.

Somadas, as duas páginas fazem 14 consultas ao banco, e o gestor precisa
visitar as duas para ter o quadro completo.

### A agenda não foi desenhada para o celular

As três visões existem e funcionam (entregues em 2026-08-27), mas duas delas
tratam o celular como um desktop estreito:

- **`GradeDoMes`** usa `grid-cols-7` sem variante para telas pequenas. Em
  360px cada dia fica com cerca de 45px, e a carga do dia é desenhada como
  pontinhos de `gap-0.5` dentro dessa célula. Não se lê, e não se acerta com
  o dedo — abaixo do mínimo de 44px de alvo de toque.
- **`GradeDaSemana`** faz o oposto: no celular ela esconde a grade
  (`lg:hidden`) e empilha os sete dias. A semana vira um scroll longo e deixa
  de parecer uma semana.

Além disso, cada visão traz seu próprio cabeçalho, então trocar de aba mexe a
tela inteira — a origem da sensação de coisa remendada.

## Quem usa, e como

Levantado com o cliente:

- **Vendedor** — vive na agenda, no celular, em pé na porta do cliente.
- **Gestor** — dois momentos distintos, em dois aparelhos:
  - manhã, no **celular**: olhada rápida, "como o time está hoje";
  - reunião semanal, no **notebook**: auditoria, filtro por pessoa, exportação.

Essa divisão é o que decide o desenho da página de gestão: não são dois
públicos, é uma página cuja densidade muda com a tela.

---

## Parte 1 — Página de Gestão

### Ordem da página

Cinco blocos, nesta ordem:

1. **Quanto foi feito** — realizadas (número grande), média por dia em campo,
   e os quatro cartões: a fazer, reagendadas, canceladas, conclusão %.
   Abaixo, o link "N agendadas depois de hoje".
2. **Precisa de atenção** — os cinco alertas, unificados: visitas atrasadas,
   clientes reagendados em série, realizadas sem relato, clientes sem visita,
   visitas fora do CRM.
3. **Movimento** — barras por dia e distribuição por tipo.
4. **Por pessoa** — uma linha por pessoa: barra de status, realizadas e
   clientes alcançados.
5. **Visitas** — a auditoria: filtros de pessoa e status, lista e exportação.

A ordem é **número → problema → contexto → pessoa → detalhe**.

Os alertas vêm antes dos gráficos porque são a única parte que pede ação.
Gráfico é contexto; alerta é trabalho. Hoje eles estão depois dos gráficos, o
que enterra o urgente atrás do ilustrativo.

### Densidade por tela

| Bloco | Celular | Notebook |
|---|---|---|
| 1 e 2 | visíveis sem scroll | lado a lado |
| 3 e 4 | empilhados | grid de duas colunas |
| 5 (auditoria) | **recolhida**, abre com um toque | aberta, filtros à mostra |

A auditoria é o único conteúdo que o celular esconde — e é exatamente o que o
gestor declarou fazer no notebook.

O recolhimento usa `<details>`/`<summary>` nativo, sem estado no cliente. No
notebook, CSS revela o conteúdo e esconde o resumo, de modo que ela apareça
sempre aberta. A alternativa — decidir por largura no cliente — produziria o
salto visível no primeiro render que a navegação já evita de propósito.

### Carregamento da auditoria

O bloco 5 fica dentro do seu próprio `<Suspense>`, com fallback de esqueleto.
Os blocos 1 a 4 aparecem assim que suas consultas terminam, sem esperar pela
lista de auditoria, que é a parte mais pesada e a menos urgente.

Isso é continuação direta do `loading.tsx` adicionado em 2026-08-27: a página
passa a ter dois pontos de parada em vez de um só.

### Consultas

A página unificada usa onze consultas:

`kpisPorVendedor`, `listarNaoSincronizadas`, `contarAgendadasAdiante`,
`serieDiaria`, `porTipo`, `clientesEmRisco`, `reagendamentosEmSerie`,
`realizadasSemRelato`, `atrasadas`, `vendedoresComVisita`,
`listarParaAuditoria`.

Contra 14 divididas em duas páginas. O ganho não é só a diferença de três: é
que o gestor deixa de abrir duas telas para ter um quadro.

`resumoPorVendedor` deixa de ser usada pela aplicação. Fica no repositório
com seus testes — é usada por ninguém, mas remover é escopo de outra tarefa e
o custo de mantê-la é zero.

### Rota e navegação

- `/painel` é a rota que sobrevive.
- `/relatorios` passa a redirecionar para `/painel`, preservando os
  parâmetros de busca (`periodo`, `vendedor`, `status`). Link salvo, aba
  aberta ou favorito de alguém não quebram.
- Na navegação, os itens "Painel" e "Relatórios" viram um só: **Gestão**. A
  barra do celular passa de cinco itens para quatro.

---

## Parte 2 — Agenda no celular

### Faixa de período constante

Uma única faixa no topo, comum às três visões: `‹ período ›` à esquerda e as
abas dia/semana/mês à direita. Ela **não se move** ao trocar de visão — só o
conteúdo abaixo troca.

Hoje cada visão desenha seu próprio cabeçalho, e a troca de aba desloca a
página inteira.

### Mês: carga por intensidade

O mês continua em sete colunas — é o modelo mental de calendário, e mexer
nisso confunde mais do que ajuda. O que muda é como a carga do dia aparece:
**intensidade de cor na célula**, em vez de pontinhos.

Escala sequencial de um matiz só, do claro ao escuro (regra de escala
sequencial: nunca arco-íris):

| Visitas no dia | Fundo | Texto |
|---|---|---|
| 0 | transparente | `text-slate-400` |
| 1–2 | `#dbeafe` | `text-slate-900` |
| 3–4 | `#93c5fd` | `text-slate-900` |
| 5+ | `#1f6fb2` | `text-white` |

O matiz é o mesmo azul já usado para "a fazer" em `Graficos.tsx` (`#1f6fb2`),
então a paleta do app não ganha uma cor nova.

Cor sozinha não carrega informação: o número de visitas do dia aparece como
texto quando há uma ou mais, e cada célula tem `aria-label` dizendo o dia e a
contagem.

Cada célula é um alvo de toque de no mínimo 44px de altura e leva para a
visão de dia daquela data.

### Semana: faixa de dias e lista

No celular, a semana deixa de ser sete blocos empilhados e passa a ser
**seletor + lista**:

- uma faixa horizontal com os sete dias, o ativo destacado, cada um com sua
  contagem;
- abaixo, a lista de visitas do dia selecionado — o mesmo componente da
  visão de dia.

É o padrão de todo aplicativo de calendário em celular, porque é o que cabe
no polegar. A noção de semana fica na faixa; o detalhe, embaixo.

O dia selecionado vive na URL, no parâmetro `data` que a agenda já usa — não
em estado de cliente. Assim o botão voltar funciona, o link pode ser
compartilhado e a faixa continua sendo apenas links.

No notebook nada muda: a grade de sete colunas lado a lado continua, que lá é
o certo e cabe.

### Dia: hierarquia e polegar

A lista já funciona; o trabalho é de acabamento:

- o horário ganha peso — é por ele que se procura numa agenda;
- o cliente é a linha forte;
- o status vira etiqueta discreta, em vez de competir com o cliente;
- a linha inteira é tocável, com altura mínima de 44px.

---

## Ordem de execução

As duas partes são independentes: não compartilham componente, consulta nem
rota. Vão em duas fases, cada uma entregando sozinha.

**Fase 1 — Gestão.** Some uma tela do aplicativo e some a duplicação de
alertas. Vai primeiro porque é a que carrega a decisão estrutural
(rota, redirecionamento, navegação); se algo nela precisar voltar atrás, é
melhor descobrir antes de mexer na agenda.

**Fase 2 — Agenda.** Puramente visual, sem mudança de rota ou de dado. Pode
ser interrompida no meio sem deixar o aplicativo incoerente.

## Arquivos

**Criar**
- `src/app/(app)/painel/Alertas.tsx` — os cinco alertas num bloco só
- `src/app/(app)/painel/Auditoria.tsx` — filtros, lista e exportação
- `src/app/(app)/agenda/FaixaDePeriodo.tsx` — navegação e abas constantes
- `src/app/(app)/agenda/SemanaNoCelular.tsx` — faixa de dias e lista

**Modificar**
- `src/app/(app)/painel/page.tsx` — passa a ser a página de gestão
- `src/app/(app)/painel/Graficos.tsx` — `BarrasPorPessoa` mostra clientes alcançados
- `src/app/(app)/relatorios/page.tsx` — vira redirecionamento
- `src/components/Navegacao.tsx` — "Painel" e "Relatórios" viram "Gestão"
- `src/app/(app)/agenda/page.tsx` — usa a faixa constante
- `src/app/(app)/agenda/GradeDoMes.tsx` — intensidade no lugar de pontinhos
- `src/app/(app)/agenda/GradeDaSemana.tsx` — grade só no notebook

## Erros e casos de borda

- **Período sem nenhuma visita** — cada bloco já tem seu estado vazio; o
  bloco de alertas some inteiro quando não há nenhum alerta, como hoje.
- **Gestor sem equipe cadastrada** — "por pessoa" mostra o estado vazio
  existente.
- **Mês com dias fora do mês corrente** — as células de preenchimento não
  recebem intensidade nem viram alvo de toque.
- **Falha de banco** — coberta pelo `error.tsx` da raiz, já existente.

## Testes

- `/relatorios` redireciona para `/painel` preservando os parâmetros de busca.
- A navegação do gestor traz "Gestão" e não traz mais "Painel" nem
  "Relatórios".
- Cada um dos cinco alertas aparece uma única vez na página.
- A faixa de intensidade escolhe o nível certo nas fronteiras: 0, 1, 2, 3, 4,
  5 e acima.
- Célula de dia fora do mês corrente não vira link.
- A auditoria continua respeitando os filtros de pessoa e status.
- A exportação em planilha continua saindo com o período filtrado.

Os testes existentes das duas páginas migram para a página unificada.

## O que fica de fora

- **Reordenar ou priorizar visitas na agenda** — foi cogitado e descartado:
  o vendedor organiza por horário, e ordenação manual é solução para um
  problema que ninguém relatou.
- **Cache das consultas de gestão** — só se a medição em produção mostrar que
  precisa.
- **`prefetch={false}` nos cards de visita** — depende de medir o efeito das
  mudanças de 2026-08-27 antes.
- **Remover `resumoPorVendedor`** — vira código sem uso, mas removê-lo é
  outra tarefa.
