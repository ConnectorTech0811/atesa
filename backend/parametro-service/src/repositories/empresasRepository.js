/**
 * Leitura mínima de empresas necessária pelo módulo Parâmetro.
 * Para operações completas de empresas, use o empresas-service.
 */
import { pool } from '../config/database.js';

const CAMPOS_LISTAGEM = `
  id, cooperativa, consultor_nome, nome_empresa, cnpj, cpf, cep, rua, numero, complemento,
  bairro, cidade, uf, email_empresa, telefone_empresa, whatsapp, representante,
  regiao_id, regiao_nome, data_primeiro_contato, executivo_id, executivo_nome,
  supervisor, status, aprovada, criado_em
`;

export async function buscarEmpresaCompletaPorId(id) {
  const [linhas] = await pool.query(`SELECT ${CAMPOS_LISTAGEM} FROM empresas WHERE id = ?`, [id]);
  return linhas[0] ?? null;
}
