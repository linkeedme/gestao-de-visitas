/**
 * Quanto trabalho tem num dia, em quatro faixas.
 *
 * O mês precisa responder "que dia está cheio" de relance, sem contar bolinha.
 * Quatro faixas bastam e não fingem uma precisão que a vista não tem: entre um
 * dia de sete e outro de nove visitas, a decisão do vendedor é a mesma.
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
 * se lê em intensidade, não em variedade de cor. O azul é o mesmo de "a fazer"
 * nos gráficos, então a paleta do app não ganha uma cor nova.
 *
 * A cor nunca informa sozinha: a célula sempre traz o número, e o `aria-label`
 * diz o dia e a contagem por extenso. Quem não distingue as quatro intensidades
 * lê exatamente a mesma coisa.
 */
export const CARGA = [
  { fundo: 'bg-slate-50', texto: 'text-slate-400' },
  { fundo: 'bg-[#dbeafe]', texto: 'text-slate-900' },
  { fundo: 'bg-[#93c5fd]', texto: 'text-slate-900' },
  { fundo: 'bg-[#1f6fb2]', texto: 'text-white' },
] as const
