
/**
 * As cores de status, validadas contra daltonismo e contraste.
 *
 * Rodadas pelo validador da disciplina de visualização: banda de luminosidade,
 * piso de croma, separação sob protanopia/deuteranopia e contraste ≥ 3:1 contra
 * a superfície. O âmbar e o cinza foram escurecidos em relação aos originais
 * do app porque ficavam em 2,7:1 e 2,5:1 — numa barra fina isso desaparece.
 *
 * Cancelada continua CINZA de propósito, e o validador reclama disso: para uma
 * paleta categórica, cinza não distingue identidade. Aqui é status, e cinza é o
 * significado — cancelar não é alarme, é desfecho. A regra que isso obriga a
 * cumprir é a de sempre acompanhar cor de rótulo, nunca cor sozinha.
 */
export const CORES = {
  realizadas: '#0e8a5f',
  aFazer: '#1f6fb2',
  reagendadas: '#b8730a',
  canceladas: '#64748b',
} as const
