import { pool } from '../config/database.js';
import { normalizarTexto } from '../utils/normalizarTexto.js';

const CAMPOS_LISTAGEM = `
  id, cooperativa, consultor_nome, nome_empresa, cnpj, cep, rua, numero, complemento,
  bairro, cidade, uf, email_empresa, telefone_empresa, representante,
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
    `SELECT e.id, e.cooperativa, e.consultor_nome, e.nome_empresa, e.cnpj,
            e.cep, e.rua, e.numero, e.complemento, e.bairro, e.cidade, e.uf,
            e.email_empresa, e.telefone_empresa, e.representante,
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
      cooperativa, consultor_nome, nome_empresa, nome_empresa_normalizado, cnpj, cep, rua, numero,
      complemento, bairro, cidade, uf, email_empresa, telefone_empresa, representante,
      regiao_id, regiao_nome, data_primeiro_contato, executivo_id, executivo_nome, supervisor
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      dados.cooperativa,
      dados.consultorNome ?? null,
      dados.nomeEmpresa,
      normalizarTexto(dados.nomeEmpresa),
      dados.cnpj ?? null,
      dados.cep ?? null,
      dados.rua ?? null,
      dados.numero ?? null,
      dados.complemento ?? null,
      dados.bairro ?? null,
      dados.cidade ?? null,
      dados.uf ?? null,
      dados.emailEmpresa,
      dados.telefoneEmpresa,
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
