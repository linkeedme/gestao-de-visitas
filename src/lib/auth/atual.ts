import { cache } from 'react'
import { redirect } from 'next/navigation'
import { buscarPorId } from './repositorio'
import { lerSessao } from './sessao'
import type { Usuario } from '@/lib/db'

/**
 * Revalida `ativo` a cada requisição. É o que permite desligar alguém na hora
 * sem manter uma tabela de sessões.
 *
 * `cache` do React não guarda nada entre requisições — o escopo dele é uma
 * requisição só, e é exatamente isso que se quer aqui. O que ele resolve é a
 * repetição dentro da mesma: o layout pergunta quem está logado para escrever
 * o nome no cabeçalho e a página pergunta de novo para filtrar a agenda, e o
 * mesmo `SELECT` ia ao banco duas vezes em toda abertura de tela — ocupando
 * duas das três conexões do pool para responder a mesma coisa.
 */
export const usuarioAtual = cache(async function usuarioAtual(): Promise<Usuario | null> {
  const id = await lerSessao()
  if (!id) return null
  const u = await buscarPorId(id)
  return u?.ativo ? u : null
})

export async function exigirUsuario(): Promise<Usuario> {
  const u = await usuarioAtual()
  if (!u) redirect('/login')
  return u
}

export async function exigirGestor(): Promise<Usuario> {
  const u = await exigirUsuario()
  if (u.papel !== 'gestor') redirect('/agenda')
  return u
}
