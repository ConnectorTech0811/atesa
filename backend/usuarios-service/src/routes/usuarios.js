import { Router } from 'express';
import bcrypt from 'bcryptjs';
import {
  buscarUsuarioPorEmail,
  criarUsuario,
  listarExecutivosPorRegiao,
  listarUsuarios,
} from '../repositories/usuariosRepository.js';
import { validarCpf } from '../utils/validarCpf.js';

const TIPOS_VALIDOS = [
  'administrador',
  'consultor',
  'executivo_contas',
  'parametro',
  'ra',
  'beneficios',
  'supervisao',
  'faturamento',
  'financeiro',
];

const router = Router();

router.get('/usuarios', async (_req, res) => {
  try {
    const usuarios = await listarUsuarios();
    res.json(usuarios);
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao listar usuários.' });
  }
});

/** Endpoint interno consumido pelo empresas-service para montar o rodízio de executivos. */
router.get('/usuarios/executivos', async (req, res) => {
  const regiaoId = Number(req.query.regiaoId);
  if (!regiaoId) {
    return res.status(400).json({ erro: 'Informe regiaoId.' });
  }
  try {
    const executivos = await listarExecutivosPorRegiao(regiaoId);
    res.json(executivos);
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao listar executivos da região.' });
  }
});

router.post('/usuarios', async (req, res) => {
  const { nome, email, cpf, telefone, senha, tipoUsuario, ehExecutivo, regiaoId } = req.body ?? {};

  if (!nome || !email || !cpf || !senha || !tipoUsuario || !regiaoId) {
    return res.status(400).json({ erro: 'Preencha nome, e-mail, CPF, senha, tipo de usuário e região.' });
  }

  if (!TIPOS_VALIDOS.includes(tipoUsuario)) {
    return res.status(400).json({ erro: 'Tipo de usuário inválido.' });
  }

  if (senha.length < 6) {
    return res.status(400).json({ erro: 'A senha deve ter pelo menos 6 caracteres.' });
  }

  const cpfLimpo = String(cpf).replace(/\D/g, '');
  if (!validarCpf(cpfLimpo)) {
    return res.status(400).json({ erro: 'CPF inválido.' });
  }

  const emailExistente = await buscarUsuarioPorEmail(email).catch(() => null);
  if (emailExistente) {
    return res.status(409).json({ erro: 'Já existe um usuário cadastrado com este e-mail.' });
  }

  try {
    const senhaHash = await bcrypt.hash(senha, 10);
    const id = await criarUsuario({
      nome,
      email,
      cpf: cpfLimpo,
      telefone,
      senhaHash,
      tipoUsuario,
      ehExecutivo: tipoUsuario === 'consultor' ? Boolean(ehExecutivo) : false,
      regiaoId,
    });
    res.status(201).json({ id });
  } catch (erro) {
    if (erro.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ erro: 'Já existe um usuário cadastrado com este e-mail ou CPF.' });
    }
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao cadastrar usuário.' });
  }
});

export default router;
