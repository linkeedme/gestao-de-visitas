import { describe, it, expect } from 'vitest'
import { getTableConfig } from 'drizzle-orm/pg-core'
import { usuario, tentativaLogin } from '@/lib/db/schema'

describe('tabela usuario', () => {
  const config = getTableConfig(usuario)
  const colunas = Object.fromEntries(config.columns.map((c) => [c.name, c]))

  it('tem as colunas que o login e o kanban precisam', () => {
    for (const nome of [
      'id',
      'nome',
      'telefone',
      'email',
      'senha_hash',
      'zaple_user_id',
      'papel',
      'ativo',
      'criado_em',
    ]) {
      expect(colunas[nome], `faltou a coluna ${nome}`).toBeDefined()
    }
  })

  it('exige telefone e senha', () => {
    expect(colunas['telefone'].notNull).toBe(true)
    expect(colunas['senha_hash'].notNull).toBe(true)
  })

  it('aceita quem não é atendente no CRM', () => {
    // O vínculo com o agente é opcional no banco porque o gestor que
    // administra o sistema não é atendente no CRM e não tem agente para
    // escolher. Exigir de todos impedia cadastrá-lo pela tela.
    //
    // Para VENDEDOR a exigência continua, mas na rota — ver
    // tests/api/usuarios.test.ts —, onde o papel é conhecido.
    expect(colunas['zaple_user_id'].notNull).toBe(false)
  })

  it('não permite dois usuários com o mesmo telefone', () => {
    expect(colunas['telefone'].isUnique).toBe(true)
  })

  it('nasce ativo e como vendedor', () => {
    expect(colunas['ativo'].hasDefault).toBe(true)
    expect(colunas['papel'].hasDefault).toBe(true)
  })
})

describe('tabela tentativa_login', () => {
  const config = getTableConfig(tentativaLogin)
  const colunas = Object.fromEntries(config.columns.map((c) => [c.name, c]))

  it('guarda o alvo e o instante da tentativa', () => {
    expect(colunas['identificador'].notNull).toBe(true)
    expect(colunas['em_janela'].notNull).toBe(true)
  })

  it('não tem coluna de senha — a tentativa é registrada, o segredo não', () => {
    expect(Object.keys(colunas)).not.toContain('senha')
    expect(Object.keys(colunas)).not.toContain('senha_hash')
  })
})
