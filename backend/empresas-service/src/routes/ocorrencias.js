import { Router } from 'express';
import { pool } from '../config/database.js';

const router = Router();

function obterUsuario(req) {
  const id = req.headers['x-usuario-id'];
  const nome = req.headers['x-usuario-nome'];
  const tipo = req.headers['x-usuario-tipo'];
  if (!id) return null;
  return { id: Number(id), nome: nome ? decodeURIComponent(nome) : 'Usuário', tipo };
}

// ── Listar ocorrências ────────────────────────────────────────────────────────

router.get('/ocorrencias', async (req, res) => {
  const usuario = obterUsuario(req);
  if (!usuario) return res.status(401).json({ erro: 'Não autenticado.' });

  const { empresa_id, cooperado_id, tipo, status } = req.query;
  const isAdmin = usuario.tipo === 'administrador';

  let sql = `SELECT o.id, o.empresa_id, e.nome_empresa, o.cooperado_id, o.cooperado_nome,
              o.tipo, o.descricao, o.status, o.gravidade, o.data_ocorrencia,
              o.registrada_por_nome, o.resolvida_em, o.resolucao,
              o.criado_em
             FROM ocorrencias o
             JOIN empresas e ON e.id = o.empresa_id
             WHERE 1=1`;
  const params = [];

  if (!isAdmin) {
    sql += ' AND (o.registrada_por_id = ? OR e.executivo_id = ?)';
    params.push(usuario.id, usuario.id);
  }
  if (empresa_id) { sql += ' AND o.empresa_id = ?'; params.push(empresa_id); }
  if (cooperado_id) { sql += ' AND o.cooperado_id = ?'; params.push(cooperado_id); }
  if (tipo) { sql += ' AND o.tipo = ?'; params.push(tipo); }
  if (status) { sql += ' AND o.status = ?'; params.push(status); }

  sql += ' ORDER BY o.data_ocorrencia DESC, o.criado_em DESC';

  try {
    const [linhas] = await pool.query(sql, params);
    res.json(linhas);
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao listar ocorrências.' });
  }
});

// ── Criar ocorrência ──────────────────────────────────────────────────────────

router.post('/ocorrencias', async (req, res) => {
  const usuario = obterUsuario(req);
  if (!usuario) return res.status(401).json({ erro: 'Não autenticado.' });

  const { empresa_id, cooperado_id, cooperado_nome, tipo, descricao, gravidade, data_ocorrencia } = req.body ?? {};

  if (!empresa_id || !tipo || !descricao || !data_ocorrencia) {
    return res.status(400).json({ erro: 'Empresa, tipo, descrição e data são obrigatórios.' });
  }

  try {
    const [resultado] = await pool.query(
      `INSERT INTO ocorrencias (empresa_id, cooperado_id, cooperado_nome, tipo, descricao, gravidade, data_ocorrencia, registrada_por_id, registrada_por_nome)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [empresa_id, cooperado_id ?? null, cooperado_nome ?? null, tipo, descricao,
       gravidade ?? 'normal', data_ocorrencia, usuario.id, usuario.nome]
    );
    res.status(201).json({ id: resultado.insertId });
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao registrar ocorrência.' });
  }
});

// ── Atualizar / Resolver ocorrência ──────────────────────────────────────────

router.patch('/ocorrencias/:id', async (req, res) => {
  const usuario = obterUsuario(req);
  if (!usuario) return res.status(401).json({ erro: 'Não autenticado.' });

  const { status, resolucao } = req.body ?? {};
  if (!status) return res.status(400).json({ erro: 'Informe o novo status.' });

  try {
    const [linhas] = await pool.query('SELECT id FROM ocorrencias WHERE id = ?', [req.params.id]);
    if (!linhas.length) return res.status(404).json({ erro: 'Ocorrência não encontrada.' });

    const resolvidaEm = status === 'resolvida' ? new Date() : null;
    await pool.query(
      `UPDATE ocorrencias SET status = ?, resolucao = ?, resolvida_em = ? WHERE id = ?`,
      [status, resolucao ?? null, resolvidaEm, req.params.id]
    );
    res.json({ ok: true });
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao atualizar ocorrência.' });
  }
});

export default router;
