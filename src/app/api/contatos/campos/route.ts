import { exigirUsuario } from '@/lib/auth/atual'
import { listarCamposDeContato } from '@/lib/zaple/campos'
import { responderErroZaple } from '@/lib/api/erros'

export async function GET() {
  await exigirUsuario()
  try {
    return Response.json({ campos: await listarCamposDeContato() })
  } catch (erro) {
    return responderErroZaple(erro)
  }
}
