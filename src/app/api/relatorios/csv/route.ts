import { exigirGestor } from '@/lib/auth/atual'
import { db } from '@/lib/visita/repositorio'
import { listarParaAuditoria } from '@/lib/visita/relatorios'
import { hoje, formatarDia } from '@/lib/visita/datas'
import { intervaloDoFiltro } from '@/lib/visita/periodo'
import { rotuloDoTipo } from '@/lib/visita/tipos'

const STATUS: Record<string, string> = {
  a_fazer: 'A fazer',
  realizada: 'Realizada',
  cancelada: 'Cancelada',
  reagendada: 'Reagendada',
}

/**
 * Escapa um campo para CSV.
 *
 * O relato é texto livre digitado na rua: tem vírgula, tem aspas, tem quebra
 * de linha. Sem escapar, uma vírgula no meio de "Comprou 3 filtros, quer
 * orçamento" empurra metade da frase para a coluna seguinte e desalinha a
 * planilha inteira a partir dali.
 */
function campo(valor: string | null | undefined): string {
  const t = (valor ?? '').replace(/\r?\n/g, ' ')
  return `"${t.replace(/"/g, '""')}"`
}

export async function GET(req: Request) {
  await exigirGestor()
  const url = new URL(req.url)

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

  const cabecalho = [
    'Data',
    'Cliente',
    'Vendedor',
    'Tipo',
    'Status',
    'Motivo da visita',
    'O que foi tratado',
    'Enviada ao CRM',
  ]

  const linhas = visitas.map((v) =>
    [
      campo(formatarDia(v.data)),
      campo(v.contatoNome),
      campo(v.vendedor),
      campo(rotuloDoTipo(v.tipo)),
      campo(STATUS[v.status] ?? v.status),
      campo(v.descricao),
      campo(v.relatorio),
      campo(v.sincronizadoEm ? 'sim' : 'não'),
    ].join(';')
  )

  // Ponto e vírgula, não vírgula: o Excel em português usa a vírgula como
  // separador decimal e abriria o arquivo inteiro numa coluna só.
  //
  // O BOM no começo é o que faz o Excel entender que é UTF-8 — sem ele,
  // "Prospecção" abre como "ProspecÃ§Ã£o" e o gestor conclui que o sistema
  // está quebrado.
  const csv = '﻿' + [cabecalho.join(';'), ...linhas].join('\r\n')

  return new Response(csv, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="visitas-${de}-a-${ate}.csv"`,
    },
  })
}
