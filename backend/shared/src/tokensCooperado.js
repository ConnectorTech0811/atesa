/**
 * Tokens de acesso do cooperado (Portal de Adesão e App).
 *
 * - O token é aleatório (32 bytes, base64url); no banco fica apenas o SHA-256.
 * - Cada token tem uma finalidade e só vale para ela:
 *     'convite' → link enviado por WhatsApp; só serve para trocar CPF/E-mail + senha por uma sessão.
 *     'sessao'  → emitido após autenticação; dá acesso às rotas do portal/app do próprio cooperado.
 * - Tokens expiram e podem ser revogados (novo convite revoga os anteriores; troca de senha revoga sessões).
 * - Nunca registrar o token em logs.
 */
import crypto from 'crypto';

export const VALIDADE_CONVITE_SEG = 30 * 24 * 60 * 60;   // 30 dias
export const VALIDADE_SESSAO_PORTAL_SEG = 12 * 60 * 60;  // 12 horas
export const VALIDADE_SESSAO_APP_SEG = 30 * 24 * 60 * 60; // 30 dias

const FINALIDADES = ['convite', 'sessao'];
const FORMATO_TOKEN = /^[A-Za-z0-9_-]{43}$/;

let tabelaPronta = null;

function garantirTabela(pool) {
  if (!tabelaPronta) {
    tabelaPronta = pool.query(`
      CREATE TABLE IF NOT EXISTS cooperado_tokens (
        id INT AUTO_INCREMENT PRIMARY KEY,
        candidato_id INT NOT NULL,
        finalidade VARCHAR(20) NOT NULL,
        token_hash CHAR(64) NOT NULL,
        expira_em DATETIME NOT NULL,
        revogado_em DATETIME NULL,
        criado_por_nome VARCHAR(255) NULL,
        criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uk_cooperado_tokens_hash (token_hash),
        INDEX idx_cooperado_tokens_cand (candidato_id, finalidade)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `).catch((err) => { tabelaPronta = null; throw err; });
  }
  return tabelaPronta;
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/** Gera e grava um token; retorna o valor em claro (único momento em que ele existe). */
export async function emitirTokenCooperado(pool, candidatoId, finalidade, validadeSeg, criadoPorNome = null) {
  if (!FINALIDADES.includes(finalidade)) throw new Error('Finalidade de token inválida.');
  await garantirTabela(pool);
  const token = crypto.randomBytes(32).toString('base64url');
  await pool.query(
    `INSERT INTO cooperado_tokens (candidato_id, finalidade, token_hash, expira_em, criado_por_nome)
     VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL ? SECOND), ?)`,
    [candidatoId, finalidade, hashToken(token), validadeSeg, criadoPorNome]
  );
  return token;
}

/** Novo link de convite: revoga os convites anteriores do cooperado e emite outro. */
export async function emitirConviteCooperado(pool, candidatoId, criadoPorNome = null) {
  await revogarTokensCooperado(pool, candidatoId, 'convite');
  return emitirTokenCooperado(pool, candidatoId, 'convite', VALIDADE_CONVITE_SEG, criadoPorNome);
}

/** Retorna o candidato_id dono do token, ou null se inválido, expirado, revogado ou de outra finalidade. */
export async function validarTokenCooperado(pool, token, finalidade) {
  if (typeof token !== 'string' || !FORMATO_TOKEN.test(token)) return null;
  await garantirTabela(pool);
  const [[linha]] = await pool.query(
    `SELECT t.candidato_id
       FROM cooperado_tokens t
       JOIN ra_candidatos c ON c.id = t.candidato_id
      WHERE t.token_hash = ? AND t.finalidade = ? AND t.revogado_em IS NULL AND t.expira_em > NOW()
      LIMIT 1`,
    [hashToken(token), finalidade]
  );
  return linha ? Number(linha.candidato_id) : null;
}

/** Revoga os tokens ativos do cooperado (de uma finalidade ou de todas). */
export async function revogarTokensCooperado(pool, candidatoId, finalidade = null) {
  await garantirTabela(pool);
  const filtro = finalidade ? ' AND finalidade = ?' : '';
  await pool.query(
    `UPDATE cooperado_tokens SET revogado_em = NOW()
      WHERE candidato_id = ? AND revogado_em IS NULL${filtro}`,
    finalidade ? [candidatoId, finalidade] : [candidatoId]
  );
}

/** Extrai o token de sessão do cabeçalho Authorization: Bearer <token>. */
export function extrairTokenBearer(req) {
  const cabecalho = req.headers.authorization || '';
  return cabecalho.startsWith('Bearer ') ? cabecalho.slice('Bearer '.length).trim() : null;
}
