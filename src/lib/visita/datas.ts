/**
 * O "hoje" do vendedor, não o do servidor.
 *
 * `new Date().toISOString()` devolve a data em UTC: das 21h à meia-noite no
 * Brasil isso já é o dia seguinte, e a agenda abriria vazia no fim da tarde,
 * justamente quando o vendedor está fechando o dia.
 */
export function hoje(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
}

/**
 * 'YYYY-MM-DD' para 'DD/MM/AAAA', sem passar por `Date`.
 *
 * `new Date('2026-08-25')` é meia-noite UTC; formatado em UTC-3 vira 24/08.
 * Como a data já é só uma data, o recorte de string é a conversão correta.
 */
export function formatarDia(data: string): string {
  const [ano, mes, dia] = data.split('-')
  return `${dia}/${mes}/${ano}`
}

/**
 * Soma (ou subtrai) dias de uma data 'YYYY-MM-DD'.
 *
 * A conta roda inteira em UTC de propósito: `new Date('2026-08-25')` é
 * meia-noite UTC, e somar dias no fuso local faria a data escorregar um dia
 * em UTC-3 — o mesmo erro que esta fatia já corrigiu duas vezes.
 */
export function somarDias(data: string, dias: number): string {
  const [ano, mes, dia] = data.split('-').map(Number)
  const d = new Date(Date.UTC(ano, mes - 1, dia))
  d.setUTCDate(d.getUTCDate() + dias)
  return d.toISOString().slice(0, 10)
}

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
