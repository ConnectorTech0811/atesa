// ── Carteira de Supervisores ─────────────────────────────────────────────────
// Clientes que cada supervisor atende no pós-venda (empresas.supervisor_id, definido no Parâmetro),
// com a próxima e a última visita da agenda (reuniões não canceladas do cliente).
// Clientes com Negócio Fechado e sem supervisor aparecem à parte, para serem distribuídos.
import { pool } from '../config/database.js';

const SQL_NEGOCIO_FECHADO = `EXISTS (
  SELECT 1 FROM trabalhos t
  JOIN contatos_trabalho ct ON ct.trabalho_id = t.id
  WHERE t.empresa_id = e.id AND ct.status_negocio = 'negocio_fechado'
)`;

// A coluna é criada pelo parametro-service; garante aqui também para não depender da ordem de subida.
let colunaGarantida = null;
function garantirColuna() {
  if (!colunaGarantida) {
    colunaGarantida = pool.query('ALTER TABLE empresas ADD COLUMN supervisor_id INT NULL').catch(() => {});
  }
  return colunaGarantida;
}

const CAMPOS_EMPRESA = `
  e.id, e.nome_empresa, e.cnpj, e.cpf, e.status, e.cidade, e.uf, e.regiao_nome,
  e.telefone_empresa, e.representante, e.executivo_nome, e.supervisor_id,
  (SELECT MIN(r.data_hora) FROM reunioes r
    WHERE r.empresa_id = e.id AND r.data_hora >= NOW() AND COALESCE(LOWER(TRIM(r.status)), '') <> 'cancelada') AS proxima_visita,
  (SELECT MAX(r.data_hora) FROM reunioes r
    WHERE r.empresa_id = e.id AND r.data_hora < NOW() AND COALESCE(LOWER(TRIM(r.status)), '') <> 'cancelada') AS ultima_visita`;

export async function listarCarteiraSupervisores() {
  await garantirColuna();
  const [supervisores] = await pool.query(
    `SELECT u.id, u.nome, u.email, u.telefone, u.regiao_id, r.nome AS regiao_nome, u.ativo
     FROM usuarios u
     LEFT JOIN regioes r ON r.id = u.regiao_id
     WHERE u.tipo_usuario = 'supervisao'
       AND (u.ativo = 1 OR EXISTS (SELECT 1 FROM empresas e WHERE e.supervisor_id = u.id))
     ORDER BY u.nome ASC`
  );
  const [clientes] = await pool.query(
    `SELECT ${CAMPOS_EMPRESA}
     FROM empresas e
     WHERE e.supervisor_id IS NOT NULL
     ORDER BY e.nome_empresa ASC`
  );
  const [semSupervisor] = await pool.query(
    `SELECT ${CAMPOS_EMPRESA}
     FROM empresas e
     WHERE e.supervisor_id IS NULL AND ${SQL_NEGOCIO_FECHADO}
     ORDER BY e.nome_empresa ASC`
  );

  const porSupervisor = new Map(supervisores.map((s) => [Number(s.id), { ...s, ativo: !!s.ativo, clientes: [] }]));
  for (const c of clientes) {
    const s = porSupervisor.get(Number(c.supervisor_id));
    if (s) s.clientes.push(c);
  }
  return { supervisores: [...porSupervisor.values()], semSupervisor };
}
