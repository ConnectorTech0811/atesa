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
