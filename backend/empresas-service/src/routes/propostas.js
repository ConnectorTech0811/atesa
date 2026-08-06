import { Router } from 'express';
import { pool } from '../config/database.js';

const router = Router();

// ── Helpers ────────────────────────────────────────────────────────────────

function obterUsuario(req) {
  const id = req.headers['x-usuario-id'];
  const nome = req.headers['x-usuario-nome'];
  if (!id) return null;
  return { id: Number(id), nome: nome ? decodeURIComponent(nome) : 'Usuário' };
}

async function enviarEmail({ destinatario, assunto, corpo, remetente }) {
  // Importação dinâmica para suportar ambientes sem nodemailer instalado
  let transporter;
  try {
    const nodemailer = await import('nodemailer');
    transporter = nodemailer.default.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  } catch {
    throw new Error('Módulo de e-mail (nodemailer) não instalado. Execute: npm install nodemailer');
  }

  if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
    throw new Error('Configurações de e-mail não definidas. Configure SMTP_HOST, SMTP_USER e SMTP_PASS nas variáveis de ambiente.');
  }

  await transporter.sendMail({
    from: `"${remetente}" <${process.env.SMTP_USER}>`,
    to: destinatario,
    subject: assunto,
    html: corpo,
  });
}

// ── Rotas ──────────────────────────────────────────────────────────────────

/** Lista o histórico de propostas de uma empresa. */
router.get('/empresas/:id/propostas', async (req, res) => {
  try {
    const [linhas] = await pool.query(
      `SELECT id, assunto, destinatario, enviada_em, enviada_por_nome, status, observacao
       FROM propostas
       WHERE empresa_id = ?
       ORDER BY enviada_em DESC`,
      [req.params.id]
    );
    res.json(linhas);
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao listar propostas.' });
  }
});

/** Registra uma proposta e a envia por e-mail. */
router.post('/empresas/:id/propostas', async (req, res) => {
  const usuario = obterUsuario(req);
  if (!usuario) return res.status(401).json({ erro: 'Usuário não autenticado.' });

  const { destinatario, assunto, corpo, observacao } = req.body ?? {};
  if (!destinatario || !assunto || !corpo) {
    return res.status(400).json({ erro: 'Destinatário, assunto e corpo são obrigatórios.' });
  }

  // Verifica se a empresa existe
  const [empresaRows] = await pool.query('SELECT nome_empresa, executivo_nome FROM empresas WHERE id = ?', [req.params.id]);
  if (!empresaRows.length) return res.status(404).json({ erro: 'Empresa não encontrada.' });
  const empresa = empresaRows[0];

  let statusEnvio = 'enviada';
  let erroEnvio = null;

  try {
    await enviarEmail({ destinatario, assunto, corpo, remetente: usuario.nome });
  } catch (e) {
    statusEnvio = 'erro';
    erroEnvio = e.message;
  }

  // Salva no histórico independente do resultado do envio
  const [resultado] = await pool.query(
    `INSERT INTO propostas (empresa_id, destinatario, assunto, corpo, observacao, enviada_por_id, enviada_por_nome, status, erro_envio)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [req.params.id, destinatario, assunto, corpo, observacao ?? null, usuario.id, usuario.nome, statusEnvio, erroEnvio]
  );

  if (statusEnvio === 'erro') {
    return res.status(207).json({
      id: resultado.insertId,
      aviso: `Proposta salva no histórico, mas o envio por e-mail falhou: ${erroEnvio}`,
      status: 'erro',
    });
  }

  res.status(201).json({ id: resultado.insertId, status: 'enviada' });
});

export default router;
