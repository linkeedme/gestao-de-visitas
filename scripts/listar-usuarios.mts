// Quem consegue entrar no app, e em que estado.
//
// Existe para o diagnóstico de "não consigo entrar": o login recusa com a
// mesma mensagem quando o telefone não existe, quando a senha não bate e
// quando a conta está desativada — de propósito, para não entregar a lista de
// quem trabalha aqui a quem estiver testando. O efeito colateral é que, do
// lado de dentro, também não dá para saber qual dos três é. Aqui dá.
//
// O hash da senha NÃO é impresso. Ele não ajuda a diagnosticar nada e
// aparecer num terminal é o começo de aparecer num print de tela.
import { listarUsuarios } from '@/lib/auth/usuarios'

const usuarios = await listarUsuarios()

if (usuarios.length === 0) {
  console.log('Nenhum usuário cadastrado. Crie o primeiro gestor:')
  console.log('  npx tsx --env-file=.env scripts/criar-gestor.mts')
  process.exit(0)
}

console.table(
  usuarios.map((u) => ({
    nome: u.nome,
    // Este é o valor com que o login compara. O que se digita na tela passa
    // por `normalizarTelefone` antes, então máscara não importa — mas o DDI
    // e o DDD sim.
    'telefone (para o login)': u.telefone,
    papel: u.papel,
    ativo: u.ativo ? 'sim' : 'NÃO — login recusado',
    'agente no CRM': u.zapleUserId ? 'sim' : 'não',
    'criado em': u.criadoEm.toISOString().slice(0, 10),
  }))
)

console.log(
  '\nPara redefinir a senha de alguém:\n' +
    '  npx tsx --env-file=.env scripts/redefinir-senha.mts <telefone> <nova senha>'
)

process.exit(0)
