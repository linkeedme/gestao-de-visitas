// Redefine a senha de quem já está cadastrado.
//
// O `criar-gestor.mts` só cria, e `usuario.telefone` é único: rodá-lo com um
// telefone que já existe falha com violação de unicidade. Quando a pessoa
// perde a senha, não havia caminho de volta sem abrir o banco na mão — a tela
// que troca senha exige um gestor logado, que é exatamente o que falta.
//
// Limpa também as tentativas recentes daquele telefone. São oito por quinze
// minutos, e quem passou a tarde tentando entrar já queimou a cota — sem
// isto, a senha nova seria recusada com "Muitas tentativas" e pareceria que
// a redefinição não funcionou.
import { eq } from 'drizzle-orm'
import { db, usuario, tentativaLogin } from '@/lib/db'
import { normalizarTelefone } from '@/lib/zaple/contatos'
import { gerarHash } from '@/lib/auth/senha'

const argumentos = process.argv.slice(2)
const ativar = argumentos.includes('--ativar')
const [telefone, novaSenha] = argumentos.filter((a) => a !== '--ativar')

if (!telefone || !novaSenha) {
  console.error('uso: redefinir-senha.mts <telefone> <nova senha> [--ativar]\n')
  console.error('  --ativar   reativa a conta, se ela estiver desligada\n')
  console.error('Para ver quem está cadastrado:')
  console.error('  npx tsx --env-file=.env scripts/listar-usuarios.mts')
  process.exit(1)
}

// A mesma senha mínima que a rota de cadastro exige. Aceitar menos aqui
// abriria pela porta dos fundos a regra que a tela cobra na porta da frente.
if (novaSenha.length < 8) {
  console.error('A senha precisa de pelo menos 8 caracteres.')
  process.exit(1)
}

const alvo = normalizarTelefone(telefone)
const [achado] = await db.select().from(usuario).where(eq(usuario.telefone, alvo)).limit(1)

if (!achado) {
  console.error(`Ninguém cadastrado com o telefone ${alvo}.`)
  console.error('(foi assim que o número que você digitou ficou depois de normalizado)\n')
  console.error('Confira a lista:')
  console.error('  npx tsx --env-file=.env scripts/listar-usuarios.mts')
  process.exit(1)
}

await db
  .update(usuario)
  .set({
    senhaHash: await gerarHash(novaSenha),
    // Reativar é decisão de quem roda, não efeito colateral: uma conta
    // desligada costuma ter sido desligada de propósito.
    ...(ativar ? { ativo: true } : {}),
  })
  .where(eq(usuario.id, achado.id))

const apagadas = await db
  .delete(tentativaLogin)
  .where(eq(tentativaLogin.identificador, alvo))
  .returning({ id: tentativaLogin.id })

console.log(`Senha redefinida para ${achado.nome} (${alvo}).`)
if (apagadas.length > 0) {
  console.log(`Limite de tentativas zerado: ${apagadas.length} tentativa(s) apagada(s).`)
}

if (!achado.ativo && !ativar) {
  console.log(
    '\nATENÇÃO: esta conta está DESATIVADA e o login vai continuar sendo recusado,\n' +
      'com a mesma mensagem de senha errada. Para reativar junto, rode de novo com --ativar.'
  )
}

process.exit(0)
