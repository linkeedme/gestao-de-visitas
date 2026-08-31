import bcrypt from 'bcryptjs'
import { normalizarTelefone } from '@/lib/zaple/contatos'
import { buscarPorTelefone } from './repositorio'
import type { ProvedorLogin } from './tipos'

const CUSTO = 12

/**
 * Hash de referência para comparar quando o usuário não existe.
 *
 * É constante escrita à mão, e não `hashSync` na carga do módulo, porque o
 * resultado nunca muda e o cálculo custava 221ms medidos — de meio a um
 * segundo e meio numa vCPU compartilhada da Vercel. Sendo síncrono, durante
 * esse tempo nada mais roda na instância: nem outra requisição, nem a leitura
 * dos sockets do Postgres. E rodava no primeiro acesso de qualquer rota que
 * importasse este arquivo, que são o login e as duas de usuários.
 *
 * Publicar este valor não custa nada: ele é o hash de uma frase conhecida que
 * não é senha de ninguém, e existe só para dar ao bcrypt algo válido para
 * comparar. O que ele protege é o relógio, não o segredo.
 */
export const HASH_FANTASMA = '$2b$12$3yqXOREVxvOYtckBkd3gu.yXLDJI2fZwlz6Efkw5Zcq7B2/WXK1Gq'

export function gerarHash(senha: string): Promise<string> {
  return bcrypt.hash(senha, CUSTO)
}

export const provedorSenha: ProvedorLogin = {
  async iniciarLogin() {
    return { precisaSegredo: true }
  },

  async confirmarLogin(identificador, segredo) {
    const u = await buscarPorTelefone(normalizarTelefone(identificador))
    // Compara mesmo sem usuário, para que o tempo de resposta não revele
    // quais telefones existem na base.
    const confere = await bcrypt.compare(segredo, u?.senhaHash ?? HASH_FANTASMA)
    if (!u || !confere || !u.ativo) return null
    return u
  },
}
