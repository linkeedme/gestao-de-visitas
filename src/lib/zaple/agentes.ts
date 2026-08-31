import { numeroDoAmbiente } from '@/lib/ambiente'
import { zapleGet } from './client'
import { criarCacheDeChamada } from './cache'
import type { Agente } from './tipos'

type AgenteApi = {
  id: string
  userId: string
  name: string
  email: string | null
  phoneNumberFormatted: string | null
  phoneNumber: string | null
}

const cache = criarCacheDeChamada<Agente[]>(numeroDoAmbiente('ZAPLE_AGENTES_TTL_MS', 300_000))

async function buscarAgentes(): Promise<Agente[]> {
  // Este endpoint devolve um array cru, sem envelope de paginação — ao
  // contrário de quase todos os outros da API.
  const agentes = await zapleGet<AgenteApi[]>('/core/v1/agent', { PageSize: 100 })
  return agentes
    .map((a) => ({
      id: a.id,
      userId: a.userId,
      nome: a.name,
      email: a.email,
      telefone: a.phoneNumberFormatted ?? a.phoneNumber,
    }))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
}

/**
 * A lista de atendentes do CRM, guardada por alguns minutos.
 *
 * Está no caminho de renderizar a tela de Equipe, que é `force-dynamic`: sem
 * cache, toda navegação para lá esperava uma ida à rede antes de qualquer HTML
 * sair. A lista muda quando alguém cadastra um atendente no CRM, o que é raro
 * e nunca urgente.
 */
export function listarAgentes(): Promise<Agente[]> {
  return cache.obter('agentes', buscarAgentes)
}

/** Esquece a lista guardada. Para teste e para os scripts de conferência. */
export function esquecerAgentes(): void {
  cache.esquecer()
}
