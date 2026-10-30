// ── Fechamento da operação por cliente × competência ─────────────────────────
// Definido com a ATESA: a edição de escalas e horários se fecha por etapas.
//   aberto      → todos os perfis com acesso às Escalas alteram.
//   supervisao  → fechamento iniciado: só o supervisor altera.
//   faturamento → fechamento concluído e encaminhado: ninguém altera.
// Para corrigir uma etapa concluída, a área solicita a reabertura ao responsável pela etapa
// seguinte: a Supervisão libera o que está com ela e o Faturamento libera o que chegou a ele.
// Solicitação e decisão exigem justificativa; toda ação fica no histórico com autor e perfil.
// Administrador e Suporte executam os dois papéis, mas também não editam sem a reabertura.
import { pool } from '../config/database.js';

export const ETAPAS = { aberto: 'Aberto', supervisao: 'Em fechamento (Supervisão)', faturamento: 'Encaminhado ao Faturamento' };
const MIN_JUSTIFICATIVA = 10;
const PERFIS_TOTAIS = ['administrador', 'suporte'];

const ehSupervisor = (perfil) => perfil === 'supervisao' || PERFIS_TOTAIS.includes(perfil);
const ehFaturamento = (perfil) => perfil === 'faturamento' || PERFIS_TOTAIS.includes(perfil);
const erro = (status, msg) => Object.assign(new Error(msg), { status });
const competenciaDe = (d) => String(d || '').slice(0, 7);
const rotuloCompetencia = (c) => `${c.slice(5, 7)}/${c.slice(0, 4)}`;

// ── Regras puras ────────────────────────────────────────────────────────────
/** Mensagem do bloqueio de edição na etapa, ou null se o perfil pode alterar. */
export function motivoBloqueio(etapa, perfil, competencia) {
  const c = rotuloCompetencia(competencia);
  if (etapa === 'faturamento') {
    return `O fechamento de ${c} deste cliente foi encaminhado ao Faturamento e não pode mais ser alterado. Solicite a reabertura em Escalas → Fechamento.`;
  }
  if (etapa === 'supervisao' && !ehSupervisor(perfil)) {
    return `O fechamento de ${c} deste cliente está com a Supervisão: só o supervisor pode alterar. Solicite a reabertura em Escalas → Fechamento.`;
  }
  return null;
}

/** O que o perfil pode fazer no fechamento, conforme a etapa e a solicitação pendente. */
export function acoesPermitidas(etapa, perfil, temPendente) {
  return {
    iniciar: etapa === 'aberto' && ehSupervisor(perfil),
    concluir: etapa === 'supervisao' && ehSupervisor(perfil),
    solicitar: !temPendente && (etapa === 'faturamento' ? ehSupervisor(perfil) : etapa === 'supervisao' && perfil !== 'faturamento'),
    decidir: temPendente && (etapa === 'faturamento' ? ehFaturamento(perfil) : etapa === 'supervisao' && ehSupervisor(perfil)),
  };
}

function exigirJustificativa(v, rotulo = 'a justificativa') {
  const t = String(v ?? '').trim().slice(0, 2000);
  if (t.length < MIN_JUSTIFICATIVA) throw erro(400, `Informe ${rotulo} (mínimo de ${MIN_JUSTIFICATIVA} caracteres).`);
  return t;
}
function exigirCompetencia(c) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(c || ''))) throw erro(400, 'Competência inválida. Use AAAA-MM.');
  return c;
}
function exigirCliente(empresaId, permitidos) {
  const id = Number(empresaId);
  if (!id) throw erro(400, 'Selecione o cliente.');
  if (permitidos && !permitidos.has(id)) throw erro(403, 'Este cliente não está liberado para o seu usuário.');
  return id;
}

// ── Estrutura ───────────────────────────────────────────────────────────────
let inicializado = null;
function inicializar() {
  if (!inicializado) {
    inicializado = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS supervisao_fechamentos (
          id INT AUTO_INCREMENT PRIMARY KEY,
          empresa_id INT NOT NULL,
          competencia CHAR(7) NOT NULL,
          etapa ENUM('aberto','supervisao','faturamento') NOT NULL DEFAULT 'aberto',
          iniciado_por_nome VARCHAR(150) NULL,
          iniciado_em DATETIME NULL,
          concluido_por_nome VARCHAR(150) NULL,
          concluido_em DATETIME NULL,
          atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          UNIQUE KEY uk_fech_cliente_comp (empresa_id, competencia),
          INDEX idx_fech_comp (competencia)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS supervisao_fechamento_reaberturas (
          id INT AUTO_INCREMENT PRIMARY KEY,
          fechamento_id INT NOT NULL,
          etapa ENUM('supervisao','faturamento') NOT NULL,
          justificativa TEXT NOT NULL,
          solicitado_por_id INT NULL,
          solicitado_por_nome VARCHAR(150) NULL,
          solicitado_por_perfil VARCHAR(50) NULL,
          solicitado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          status ENUM('pendente','liberada','recusada') NOT NULL DEFAULT 'pendente',
          chave_pendente INT NULL,
          decisao_justificativa TEXT NULL,
          decidido_por_id INT NULL,
          decidido_por_nome VARCHAR(150) NULL,
          decidido_por_perfil VARCHAR(50) NULL,
          decidido_em DATETIME NULL,
          UNIQUE KEY uk_fech_pendente (chave_pendente),
          INDEX idx_fech_reab (fechamento_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS supervisao_fechamento_historico (
          id INT AUTO_INCREMENT PRIMARY KEY,
          fechamento_id INT NOT NULL,
          acao VARCHAR(40) NOT NULL,
          etapa_anterior VARCHAR(20) NULL,
          etapa_nova VARCHAR(20) NULL,
          justificativa TEXT NULL,
          usuario_id INT NULL,
          usuario_nome VARCHAR(150) NULL,
          usuario_perfil VARCHAR(50) NULL,
          criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_fech_hist (fechamento_id, criado_em)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
    })().catch((err) => {
      inicializado = null;
      console.error('[fechamento] Erro ao criar tabelas:', err?.message);
      throw err;
    });
  }
  return inicializado;
}

async function emTransacao(fn) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const r = await fn(conn);
    await conn.commit();
    return r;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

const registrar = (conn, fechamentoId, usuario, acao, { anterior = null, nova = null, justificativa = null } = {}) => conn.query(
  `INSERT INTO supervisao_fechamento_historico (fechamento_id, acao, etapa_anterior, etapa_nova, justificativa, usuario_id, usuario_nome, usuario_perfil) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  [fechamentoId, acao, anterior, nova, justificativa, usuario.id ?? null, usuario.nome ?? null, usuario.tipoUsuario ?? null]
);

async function carregar(conn, empresaId, competencia) {
  await conn.query(`INSERT IGNORE INTO supervisao_fechamentos (empresa_id, competencia) VALUES (?, ?)`, [empresaId, competencia]);
  const [[f]] = await conn.query(`SELECT * FROM supervisao_fechamentos WHERE empresa_id = ? AND competencia = ? FOR UPDATE`, [empresaId, competencia]);
  return f;
}

// ── Trava de edição (chamada pelas escalas, apontamentos e complementos) ────
/** Lança 403/409 se a etapa do fechamento de algum cliente × competência impedir a alteração. */
export async function exigirEdicaoLiberada({ empresaIds, datas, usuario }) {
  const empresas = [...new Set(empresaIds.filter(Boolean).map(Number))];
  const comps = [...new Set(datas.filter(Boolean).map(competenciaDe))].filter((c) => /^\d{4}-\d{2}$/.test(c));
  if (!empresas.length || !comps.length) return;
  await inicializar();
  const [rows] = await pool.query(
    `SELECT competencia, etapa FROM supervisao_fechamentos WHERE empresa_id IN (?) AND competencia IN (?) AND etapa <> 'aberto'`, [empresas, comps]
  );
  for (const r of rows) {
    const msg = motivoBloqueio(r.etapa, usuario?.tipoUsuario, r.competencia);
    if (msg) throw erro(r.etapa === 'faturamento' ? 409 : 403, msg);
  }
}

/** Clientes do apontamento/complemento: a alocação informada ou as alocações ativas do cooperado. */
export async function clientesDoCooperado(candidatoId, alocacaoId = null) {
  const [rows] = alocacaoId
    ? await pool.query(`SELECT empresa_id FROM ra_alocacoes WHERE id = ?`, [Number(alocacaoId)])
    : await pool.query(`SELECT DISTINCT empresa_id FROM ra_alocacoes WHERE candidato_id = ? AND status = 'ativa'`, [Number(candidatoId)]);
  return rows.map((r) => r.empresa_id);
}

// ── Consulta ────────────────────────────────────────────────────────────────
export async function listarFechamentos({ competencia } = {}, usuario, permitidos = null) {
  await inicializar();
  exigirCompetencia(competencia);
  const [rows] = await pool.query(
    `SELECT e.id AS empresa_id, e.nome_empresa, f.id, COALESCE(f.etapa, 'aberto') AS etapa, f.iniciado_por_nome, f.iniciado_em, f.concluido_por_nome, f.concluido_em,
            r.id AS reabertura_id, r.justificativa AS reabertura_justificativa, r.solicitado_por_nome AS reabertura_por_nome, r.solicitado_por_perfil AS reabertura_por_perfil, r.solicitado_em AS reabertura_em
       FROM empresas e
       LEFT JOIN supervisao_fechamentos f ON f.empresa_id = e.id AND f.competencia = ?
       LEFT JOIN supervisao_fechamento_reaberturas r ON r.fechamento_id = f.id AND r.status = 'pendente'
      WHERE f.id IS NOT NULL
         OR EXISTS (SELECT 1 FROM supervisao_escalas s WHERE s.empresa_id = e.id AND DATE_FORMAT(s.data, '%Y-%m') = ?)
         OR EXISTS (SELECT 1 FROM ra_alocacoes a WHERE a.empresa_id = e.id AND a.status = 'ativa')
      ORDER BY e.nome_empresa`,
    [competencia, competencia]
  );
  return rows
    .filter((r) => !permitidos || permitidos.has(Number(r.empresa_id)))
    .map((r) => ({ ...r, competencia, acoes: acoesPermitidas(r.etapa, usuario.tipoUsuario, !!r.reabertura_id) }));
}

export async function historicoFechamento({ empresaId, competencia } = {}, permitidos = null) {
  await inicializar();
  const id = exigirCliente(empresaId, permitidos);
  const [rows] = await pool.query(
    `SELECT h.* FROM supervisao_fechamento_historico h JOIN supervisao_fechamentos f ON f.id = h.fechamento_id
      WHERE f.empresa_id = ? AND f.competencia = ? ORDER BY h.criado_em DESC, h.id DESC`,
    [id, exigirCompetencia(competencia)]
  );
  return rows;
}

// ── Etapas ──────────────────────────────────────────────────────────────────
export async function iniciarFechamento({ empresaId, competencia } = {}, usuario, permitidos = null) {
  await inicializar();
  const id = exigirCliente(empresaId, permitidos);
  exigirCompetencia(competencia);
  return emTransacao(async (conn) => {
    const f = await carregar(conn, id, competencia);
    if (!acoesPermitidas(f.etapa, usuario.tipoUsuario, false).iniciar) {
      throw erro(f.etapa === 'aberto' ? 403 : 409, f.etapa === 'aberto' ? 'Somente a Supervisão pode iniciar o fechamento.' : 'O fechamento já foi iniciado.');
    }
    await conn.query(`UPDATE supervisao_fechamentos SET etapa = 'supervisao', iniciado_por_nome = ?, iniciado_em = NOW() WHERE id = ?`, [usuario.nome ?? null, f.id]);
    await registrar(conn, f.id, usuario, 'inicio', { anterior: f.etapa, nova: 'supervisao' });
    return { ok: true };
  });
}

export async function concluirFechamento({ empresaId, competencia } = {}, usuario, permitidos = null) {
  await inicializar();
  const id = exigirCliente(empresaId, permitidos);
  exigirCompetencia(competencia);
  return emTransacao(async (conn) => {
    const f = await carregar(conn, id, competencia);
    if (!acoesPermitidas(f.etapa, usuario.tipoUsuario, false).concluir) {
      throw erro(f.etapa === 'supervisao' ? 403 : 409, f.etapa === 'supervisao' ? 'Somente a Supervisão pode concluir o fechamento.' : 'Inicie o fechamento antes de encaminhar ao Faturamento.');
    }
    const [[pendente]] = await conn.query(`SELECT id FROM supervisao_fechamento_reaberturas WHERE fechamento_id = ? AND status = 'pendente'`, [f.id]);
    if (pendente) throw erro(409, 'Há uma solicitação de reabertura pendente: decida antes de encaminhar ao Faturamento.');
    await conn.query(`UPDATE supervisao_fechamentos SET etapa = 'faturamento', concluido_por_nome = ?, concluido_em = NOW() WHERE id = ?`, [usuario.nome ?? null, f.id]);
    await registrar(conn, f.id, usuario, 'conclusao', { anterior: f.etapa, nova: 'faturamento' });
    return { ok: true };
  });
}

export async function solicitarReabertura({ empresaId, competencia, justificativa } = {}, usuario, permitidos = null) {
  await inicializar();
  const id = exigirCliente(empresaId, permitidos);
  exigirCompetencia(competencia);
  const just = exigirJustificativa(justificativa);
  return emTransacao(async (conn) => {
    const f = await carregar(conn, id, competencia);
    if (f.etapa === 'aberto') throw erro(409, 'Este fechamento já está aberto.');
    const [[pendente]] = await conn.query(`SELECT id FROM supervisao_fechamento_reaberturas WHERE fechamento_id = ? AND status = 'pendente'`, [f.id]);
    if (pendente) throw erro(409, 'Já existe uma solicitação de reabertura pendente.');
    if (!acoesPermitidas(f.etapa, usuario.tipoUsuario, false).solicitar) {
      throw erro(403, f.etapa === 'faturamento' ? 'A reabertura do que está no Faturamento é solicitada pela Supervisão.' : 'Seu perfil não solicita a reabertura desta etapa.');
    }
    const [res] = await conn.query(
      `INSERT INTO supervisao_fechamento_reaberturas (fechamento_id, etapa, justificativa, solicitado_por_id, solicitado_por_nome, solicitado_por_perfil, chave_pendente) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [f.id, f.etapa, just, usuario.id ?? null, usuario.nome ?? null, usuario.tipoUsuario ?? null, f.id]
    );
    await registrar(conn, f.id, usuario, 'reabertura_solicitada', { anterior: f.etapa, nova: f.etapa, justificativa: just });
    return { ok: true, id: res.insertId };
  });
}

/** Libera ou recusa a reabertura. Liberada, o processo volta uma etapa. */
export async function decidirReabertura({ empresaId, competencia, liberar, justificativa } = {}, usuario, permitidos = null) {
  await inicializar();
  const id = exigirCliente(empresaId, permitidos);
  exigirCompetencia(competencia);
  const just = exigirJustificativa(justificativa);
  const resultado = await emTransacao(async (conn) => {
    const f = await carregar(conn, id, competencia);
    const [[r]] = await conn.query(`SELECT * FROM supervisao_fechamento_reaberturas WHERE fechamento_id = ? AND status = 'pendente' FOR UPDATE`, [f.id]);
    if (!r) throw erro(409, 'Não há solicitação de reabertura pendente.');
    if (!acoesPermitidas(f.etapa, usuario.tipoUsuario, true).decidir) {
      throw erro(403, f.etapa === 'faturamento' ? 'Somente o Faturamento libera o que já foi encaminhado a ele.' : 'Somente a Supervisão libera esta etapa.');
    }
    const nova = liberar ? (f.etapa === 'faturamento' ? 'supervisao' : 'aberto') : f.etapa;
    await conn.query(
      `UPDATE supervisao_fechamento_reaberturas SET status = ?, chave_pendente = NULL, decisao_justificativa = ?, decidido_por_id = ?, decidido_por_nome = ?, decidido_por_perfil = ?, decidido_em = NOW() WHERE id = ?`,
      [liberar ? 'liberada' : 'recusada', just, usuario.id ?? null, usuario.nome ?? null, usuario.tipoUsuario ?? null, r.id]
    );
    if (liberar) await conn.query(`UPDATE supervisao_fechamentos SET etapa = ? WHERE id = ?`, [nova, f.id]);
    await registrar(conn, f.id, usuario, liberar ? 'reabertura_liberada' : 'reabertura_recusada', { anterior: f.etapa, nova, justificativa: just });
    return { ok: true, etapa: nova, reaberto: !!liberar && f.etapa === 'faturamento' };
  });
  if (!resultado.reaberto) return resultado;
  // A apuração aprovada é uma fotografia: corrigir escalas não altera o que já foi aprovado
  const [aprovados] = await pool.query(`SELECT codigo FROM faturamento_processos WHERE empresa_id = ? AND competencia = ? AND status = 'aprovado'`, [id, competencia]).catch(() => [[]]);
  return { ...resultado, aviso: aprovados.length ? `Processo ${aprovados.map((p) => p.codigo).join(', ')} já aprovado: as correções não alteram a apuração aprovada.` : null };
}
