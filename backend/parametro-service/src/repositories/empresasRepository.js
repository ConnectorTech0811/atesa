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

/**
 * Condições de cobrança definidas na proposta comercial da empresa, usadas para
 * preencher automaticamente as fichas do Parâmetro. Considera o trabalho mais
 * avançado (fechado > proposta aceita > proposta enviada > ...), ignorando cancelados.
 */
export async function buscarCondicoesPropostaPorEmpresa(empresaId) {
  const [linhas] = await pool.query(
    `SELECT t.id AS trabalho_id, t.titulo, t.status, t.executivo_nome,
            u.email AS executivo_email, u.telefone AS executivo_telefone,
            pt.fat_taxa_servico, pt.fat_impostos, pt.fat_apresentacao_cliente, pt.fat_periodo_apuracao,
            pt.fat_data_envio_boleto, pt.fat_apresentacao_faturamento, pt.fat_vencimento,
            pt.fat_repasse_cooperado, pt.fat_tera_adiantamento, pt.fat_vencimento_adiantamento,
            pt.fat_repasse_adiantamento, pt.fat_obs_faturamento, pt.fat_obs_financeiro
     FROM trabalhos t
     JOIN parametros_trabalho pt ON pt.trabalho_id = t.id
     LEFT JOIN usuarios u ON u.id = t.executivo_id
     WHERE t.empresa_id = ? AND t.status <> 'cancelado'
     ORDER BY FIELD(t.status, 'fechado', 'proposta_aceita', 'proposta_enviada', 'em_andamento', 'em_aberto'),
              pt.atualizado_em DESC
     LIMIT 1`,
    [empresaId]
  );
  return linhas[0] ?? null;
}
