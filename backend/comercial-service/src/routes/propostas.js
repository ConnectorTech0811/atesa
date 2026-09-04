import { Router } from 'express';
import { pool } from '../config/database.js';
import { obterUsuarioAutenticado } from '../../../shared/src/auth.js';
import { enviarEmail as enviarEmailShared, enviarEmailInstitucional } from '../../../shared/src/email.js';

const router = Router();

async function enviarEmail({ destinatario, assunto, corpo, remetente }) {
  if (corpo && !corpo.includes('<html')) {
    return enviarEmailInstitucional({
      para: destinatario,
      assunto,
      titulo: assunto,
      corpoHtml: corpo.replace(/\n/g, '<br />'),
      remetenteNome: remetente ? `ATESA (${remetente})` : 'ATESA Comercial',
    });
  }
  return enviarEmailShared({
    para: destinatario,
    assunto,
    html: corpo,
    remetenteNome: remetente ? `ATESA (${remetente})` : 'ATESA Comercial',
  });
}

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

router.post('/empresas/:id/propostas', async (req, res) => {
  const usuario = obterUsuarioAutenticado(req);
  if (!usuario) return res.status(401).json({ erro: 'Usuário não autenticado.' });

  const { destinatario, assunto, corpo, observacao } = req.body ?? {};
  if (!destinatario || !assunto || !corpo) {
    return res.status(400).json({ erro: 'Destinatário, assunto e corpo são obrigatórios.' });
  }

  const [empresaRows] = await pool.query('SELECT nome_empresa, executivo_nome FROM empresas WHERE id = ?', [req.params.id]);
  if (!empresaRows.length) return res.status(404).json({ erro: 'Empresa não encontrada.' });

  let statusEnvio = 'enviada';
  let erroEnvio = null;

  try {
    await enviarEmail({ destinatario, assunto, corpo, remetente: usuario.nome });
  } catch (e) {
    statusEnvio = 'erro';
    erroEnvio = e.message;
  }

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
