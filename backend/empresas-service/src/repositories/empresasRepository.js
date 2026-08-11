import { pool } from '../config/database.js';
import { normalizarTexto } from '../utils/normalizarTexto.js';

const CAMPOS_LISTAGEM = `
  id, cooperativa, consultor_nome, nome_empresa, cnpj, cpf, cep, rua, numero, complemento,
  bairro, cidade, uf, email_empresa, telefone_empresa, whatsapp, representante,
  regiao_id, regiao_nome, data_primeiro_contato, executivo_id, executivo_nome,
  supervisor, status, aprovada, criado_em
`;

export async function listarEmpresas() {
  const [linhas] = await pool.query(`SELECT ${CAMPOS_LISTAGEM} FROM empresas ORDER BY criado_em DESC`);
  return linhas;
}

export async function buscarEmpresaPorId(id) {
  const [linhas] = await pool.query('SELECT id FROM empresas WHERE id = ?', [id]);
  return linhas[0] ?? null;
}

/**
 * Busca empresas com nome parecido (fonética via SOUNDEX + substring),
 * para alertar o consultor de um possível cadastro duplicado antes de
 * salvar. É só um alerta — não bloqueia o cadastro.
 */
/** Verifica se já existe empresa com o mesmo e-mail exato (chave única). */
export async function verificarEmailDuplicado(email, excluirId = null) {
  if (!email) return null;
  const sql = excluirId
    ? 'SELECT id, nome_empresa FROM empresas WHERE email_empresa = ? AND id <> ? LIMIT 1'
    : 'SELECT id, nome_empresa FROM empresas WHERE email_empresa = ? LIMIT 1';
  const params = excluirId ? [email, excluirId] : [email];
  const [linhas] = await pool.query(sql, params);
  return linhas[0] ?? null;
}

/** Verifica se já existe empresa com o mesmo telefone (comparação por dígitos,
 *  compatível com MySQL 5.7 e 8.0). */
export async function verificarTelefoneDuplicado(telefone, excluirId = null) {
  if (!telefone) return null;
  const limpo = String(telefone).replace(/\D/g, '');
  if (!limpo) return null;
  // Busca no JS para evitar REGEXP_REPLACE (MySQL 8+ only)
  const sql = excluirId
    ? 'SELECT id, nome_empresa, telefone_empresa FROM empresas WHERE telefone_empresa IS NOT NULL AND id <> ?'
    : 'SELECT id, nome_empresa, telefone_empresa FROM empresas WHERE telefone_empresa IS NOT NULL';
  const params = excluirId ? [excluirId] : [];
  const [linhas] = await pool.query(sql, params);
  const encontrada = linhas.find((r) => String(r.telefone_empresa).replace(/\D/g, '') === limpo);
  return encontrada ?? null;
}

export async function buscarEmpresasPorDominioEmail(dominio) {
  if (!dominio || dominio.length < 3) return [];
  const [linhas] = await pool.query(
    `SELECT id, nome_empresa, email_empresa, status
     FROM empresas
     WHERE email_empresa LIKE CONCAT('%@', ?)
     LIMIT 10`,
    [dominio]
  );
  return linhas;
}

export async function obterMetricasExecutivo(executivoId, isAdmin) {
  const filtroExec = isAdmin ? '' : 'WHERE e.executivo_id = ?';
  const params = isAdmin ? [] : [executivoId];

  const [[{ total_empresas, total_alertas }]] = await pool.query(
    `SELECT
       COUNT(*) AS total_empresas,
       SUM(CASE WHEN EXISTS (
         SELECT 1 FROM contatos_trabalho ct
         JOIN trabalhos t ON t.id = ct.trabalho_id
         WHERE t.empresa_id = e.id
           AND ct.status_negocio = 'negocio_frustrado'
           AND ct.alerta_em <= CURDATE()
           AND t.status NOT IN ('fechado','cancelado')
       ) THEN 1 ELSE 0 END) AS total_alertas
     FROM empresas e ${filtroExec}`,
    params
  );

  const [statusEmpresas] = await pool.query(
    `SELECT e.status, COUNT(*) AS total
     FROM empresas e ${filtroExec}
     GROUP BY e.status
     ORDER BY total DESC`,
    params
  );

  const [statusTrabalhos] = await pool.query(
    `SELECT t.status, COUNT(*) AS total
     FROM trabalhos t
     JOIN empresas e ON e.id = t.empresa_id
     ${isAdmin ? '' : 'WHERE e.executivo_id = ?'}
     GROUP BY t.status`,
    params
  );

  const [funil] = await pool.query(
    `SELECT ct.status_negocio, COUNT(*) AS total
     FROM contatos_trabalho ct
     JOIN trabalhos t ON t.id = ct.trabalho_id
     JOIN empresas e ON e.id = t.empresa_id
     WHERE ct.status_negocio IS NOT NULL
     ${isAdmin ? '' : 'AND e.executivo_id = ?'}
     GROUP BY ct.status_negocio
     ORDER BY total DESC`,
    params
  );

  const [[{ reunioes_proximas }]] = await pool.query(
    `SELECT COUNT(*) AS reunioes_proximas
     FROM reunioes r
     JOIN empresas e ON e.id = r.empresa_id
     WHERE r.status = 'agendada'
       AND r.data_hora BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL 7 DAY)
       ${isAdmin ? '' : 'AND e.executivo_id = ?'}`,
    params
  );

  const [reunioesEmpresasRows] = await pool.query(
    `SELECT DISTINCT r.empresa_id
     FROM reunioes r
     JOIN empresas e ON e.id = r.empresa_id
     WHERE r.status = 'agendada'
       AND r.data_hora BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL 7 DAY)
       ${isAdmin ? '' : 'AND e.executivo_id = ?'}`,
    params
  );

  // empresa_ids por status_negocio do funil
  const [funilIdsRows] = await pool.query(
    `SELECT ct.status_negocio, t.empresa_id
     FROM contatos_trabalho ct
     JOIN trabalhos t ON t.id = ct.trabalho_id
     JOIN empresas e ON e.id = t.empresa_id
     WHERE ct.status_negocio IS NOT NULL
       ${isAdmin ? '' : 'AND e.executivo_id = ?'}`,
    params
  );
  const funilEmpresaIdsPorStatus = {};
  for (const row of funilIdsRows) {
    if (!funilEmpresaIdsPorStatus[row.status_negocio]) funilEmpresaIdsPorStatus[row.status_negocio] = new Set();
    funilEmpresaIdsPorStatus[row.status_negocio].add(row.empresa_id);
  }
  for (const k of Object.keys(funilEmpresaIdsPorStatus)) {
    funilEmpresaIdsPorStatus[k] = [...funilEmpresaIdsPorStatus[k]];
  }

  // empresa_ids por status de trabalho
  const [trabalhoIdsRows] = await pool.query(
    `SELECT t.status, t.empresa_id
     FROM trabalhos t
     JOIN empresas e ON e.id = t.empresa_id
     ${isAdmin ? '' : 'WHERE e.executivo_id = ?'}`,
    params
  );
  const trabalhoEmpresaIdsPorStatus = {};
  for (const row of trabalhoIdsRows) {
    if (!trabalhoEmpresaIdsPorStatus[row.status]) trabalhoEmpresaIdsPorStatus[row.status] = new Set();
    trabalhoEmpresaIdsPorStatus[row.status].add(row.empresa_id);
  }
  for (const k of Object.keys(trabalhoEmpresaIdsPorStatus)) {
    trabalhoEmpresaIdsPorStatus[k] = [...trabalhoEmpresaIdsPorStatus[k]];
  }

  const reunioesEmpresaIds = reunioesEmpresasRows.map((r) => r.empresa_id);
  const negocioFechadoEmpresaIds = funilEmpresaIdsPorStatus['negocio_fechado'] ?? [];

  return { total_empresas, total_alertas, reunioes_proximas, statusEmpresas, statusTrabalhos, funil, reunioesEmpresaIds, negocioFechadoEmpresaIds, funilEmpresaIdsPorStatus, trabalhoEmpresaIdsPorStatus };
}

export async function buscarEmpresasPorNomeParecido(nome) {
  const nomeNormalizado = normalizarTexto(nome);
  if (!nomeNormalizado) return [];

  const [linhas] = await pool.query(
    `SELECT id, nome_empresa, cnpj, status
     FROM empresas
     WHERE SOUNDEX(nome_empresa_normalizado) = SOUNDEX(?)
        OR nome_empresa_normalizado LIKE CONCAT('%', ?, '%')
     LIMIT 10`,
    [nomeNormalizado, nomeNormalizado]
  );
  return linhas;
}

export async function listarEmpresasPorExecutivo(executivoId) {
  const [linhas] = await pool.query(
    `SELECT e.id, e.cooperativa, e.consultor_nome, e.nome_empresa, e.cnpj, e.cpf,
            e.cep, e.rua, e.numero, e.complemento, e.bairro, e.cidade, e.uf,
            e.email_empresa, e.telefone_empresa, e.whatsapp, e.representante,
            e.regiao_id, e.regiao_nome, e.data_primeiro_contato,
            e.executivo_id, e.executivo_nome, e.supervisor, e.status,
            e.aprovada, e.criado_em,
            (SELECT COUNT(*) > 0
             FROM contatos_trabalho ct
             JOIN trabalhos t ON t.id = ct.trabalho_id
             WHERE t.empresa_id = e.id
               AND ct.status_negocio = 'negocio_frustrado'
               AND ct.alerta_em <= CURDATE()
               AND t.status NOT IN ('fechado','cancelado')
            ) AS tem_alerta
     FROM empresas e
     WHERE e.executivo_id = ?
     ORDER BY e.atualizado_em DESC`,
    [executivoId]
  );
  return linhas;
}

export async function buscarEmpresaCompletaPorId(id) {
  const [linhas] = await pool.query(`SELECT ${CAMPOS_LISTAGEM} FROM empresas WHERE id = ?`, [id]);
  return linhas[0] ?? null;
}

export async function atualizarEmpresa(id, dados) {
  const { nomeEmpresa, cnpj, cep, rua, numero, complemento, bairro, cidade, uf,
          emailEmpresa, telefoneEmpresa, representante, dataPrimeiroContato, status } = dados;
  await pool.query(
    `UPDATE empresas SET
       nome_empresa = ?, nome_empresa_normalizado = ?, cnpj = ?, cep = ?, rua = ?, numero = ?,
       complemento = ?, bairro = ?, cidade = ?, uf = ?, email_empresa = ?, telefone_empresa = ?,
       representante = ?, data_primeiro_contato = ?, status = ?, atualizado_em = NOW()
     WHERE id = ?`,
    [nomeEmpresa, normalizarTexto(nomeEmpresa), cnpj ?? null, cep ?? null, rua ?? null,
     numero ?? null, complemento ?? null, bairro ?? null, cidade ?? null, uf ?? null,
     emailEmpresa, telefoneEmpresa, representante ?? null, dataPrimeiroContato ?? null, status, id]
  );
}

export async function atualizarTelefoneEmpresa(id, telefone) {
  await pool.query('UPDATE empresas SET telefone_empresa = ?, atualizado_em = NOW() WHERE id = ?', [telefone, id]);
}

/** Insere a empresa usando uma conexão/transação já aberta pelo chamador. */
export async function inserirEmpresa(conexao, dados) {
  const [resultado] = await conexao.query(
    `INSERT INTO empresas (
      cooperativa, consultor_nome, nome_empresa, nome_empresa_normalizado, cnpj, cpf, cep, rua, numero,
      complemento, bairro, cidade, uf, email_empresa, telefone_empresa, whatsapp, representante,
      regiao_id, regiao_nome, data_primeiro_contato, executivo_id, executivo_nome, supervisor
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      dados.cooperativa,
      dados.consultorNome ?? null,
      dados.nomeEmpresa,
      normalizarTexto(dados.nomeEmpresa),
      dados.cnpj ?? null,
      dados.cpf ?? null,
      dados.cep ?? null,
      dados.rua ?? null,
      dados.numero ?? null,
      dados.complemento ?? null,
      dados.bairro ?? null,
      dados.cidade ?? null,
      dados.uf ?? null,
      dados.emailEmpresa,
      dados.telefoneEmpresa ?? null,
      dados.whatsapp ?? null,
      dados.representante ?? null,
      dados.regiaoId ?? null,
      dados.regiaoNome ?? null,
      dados.dataPrimeiroContato ?? null,
      dados.executivoId ?? null,
      dados.executivoNome ?? null,
      dados.supervisor ?? null,
    ]
  );
  return resultado.insertId;
}
