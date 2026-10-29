// ── Solicitações de abertura / reabertura de vagas ───────────────────────────
// O cliente pede mais pessoas para uma vaga do Parâmetro (ex.: +2 na Produção). A solicitação é
// registrada e fica pendente até a Supervisão decidir:
//  - Aumento de quadro: ao aprovar, a quantidade da vaga no Parâmetro sobe (com incremento e log do
//    Parâmetro) e abrem-se N posições na mesma vaga.
//  - Reabertura (reposição): não muda a quantidade; reabre N posições já previstas que estão sem cooperado.
// Cada posição aberta fica em controle até ser preenchida (cooperado alocado na vaga) ou cancelada.
// Toda ação vai para o histórico com autor (nome + perfil) e data/hora.
import { pool } from '../config/database.js';
import { ROTULO_PERFIL } from './escalaFaturamentoRepository.js';

export const TIPOS_SOLICITACAO = {
  aumento_quadro: 'Aumento de quadro (vagas novas)',
  reabertura: 'Reabertura (reposição)',
};
const ROTULO_ACAO = {
  criada: 'Solicitação registrada',
  aprovada: 'Solicitação aprovada',
  recusada: 'Solicitação recusada',
  cancelada: 'Solicitação cancelada',
  posicao_preenchida: 'Posição preenchida',
  posicao_cancelada: 'Posição cancelada',
  posicao_reaberta: 'Posição reaberta',
};
const MAX_QUANTIDADE = 100;

let inicializado = null;
function inicializar() {
  if (!inicializado) {
    inicializado = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS supervisao_solicitacoes_vaga (
          id INT AUTO_INCREMENT PRIMARY KEY,
          empresa_id INT NOT NULL,
          unidade_id INT NOT NULL,
          vaga_id INT NOT NULL,
          tipo ENUM('aumento_quadro', 'reabertura') NOT NULL,
          quantidade INT NOT NULL,
          motivo TEXT NOT NULL,
          solicitante_cliente VARCHAR(150) NULL,
          data_solicitacao DATE NOT NULL,
          data_inicio_prevista DATE NULL,
          status ENUM('pendente', 'aprovada', 'recusada', 'cancelada') NOT NULL DEFAULT 'pendente',
          quantidade_anterior INT NULL,
          quantidade_nova INT NULL,
          criado_por_id INT NULL,
          criado_por_nome VARCHAR(150) NULL,
          criado_por_perfil VARCHAR(50) NULL,
          decidido_por_id INT NULL,
          decidido_por_nome VARCHAR(150) NULL,
          decidido_por_perfil VARCHAR(50) NULL,
          decidido_em DATETIME NULL,
          observacao_decisao TEXT NULL,
          criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_ssv_status (status, criado_em),
          INDEX idx_ssv_vaga (vaga_id),
          INDEX idx_ssv_empresa (empresa_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS supervisao_vaga_posicoes (
          id INT AUTO_INCREMENT PRIMARY KEY,
          solicitacao_id INT NOT NULL,
          vaga_id INT NOT NULL,
          numero INT NOT NULL,
          status ENUM('aberta', 'preenchida', 'cancelada') NOT NULL DEFAULT 'aberta',
          candidato_id INT NULL,
          alterado_por_nome VARCHAR(150) NULL,
          alterado_por_perfil VARCHAR(50) NULL,
          alterado_em DATETIME NULL,
          observacao TEXT NULL,
          criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_svp_solicitacao (solicitacao_id),
          INDEX idx_svp_vaga (vaga_id, status)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS supervisao_solicitacoes_vaga_historico (
          id INT AUTO_INCREMENT PRIMARY KEY,
          solicitacao_id INT NOT NULL,
          posicao_id INT NULL,
          acao VARCHAR(40) NOT NULL,
          descricao TEXT NULL,
          autor_id INT NULL,
          autor_nome VARCHAR(150) NULL,
          autor_perfil VARCHAR(50) NULL,
          criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_ssvh_solicitacao (solicitacao_id, criado_em)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
    })().catch((e) => { inicializado = null; throw e; });
  }
  return inicializado;
}

const erro = (status, msg) => Object.assign(new Error(msg), { status });
const hojeISO = () => new Date().toISOString().slice(0, 10);
const dataValida = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
const permite = (permitidos, empresaId) => !permitidos || permitidos.has(Number(empresaId));

async function registrar(conexao, solicitacaoId, acao, descricao, autor, posicaoId = null) {
  await conexao.query(
    `INSERT INTO supervisao_solicitacoes_vaga_historico (solicitacao_id, posicao_id, acao, descricao, autor_id, autor_nome, autor_perfil)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [solicitacaoId, posicaoId, acao, descricao, autor?.id ?? null, autor?.nome ?? null, autor?.tipoUsuario ?? null]
  );
}

/** Registra também no log do Parâmetro, para aparecer no histórico do cliente/vaga. */
async function logParametro(conexao, { empresaId, unidadeId, vagaId, autor, acao, descricao, dadosNovos }) {
  await conexao.query(
    `INSERT INTO parametro_log_acoes (empresa_id, unidade_id, vaga_id, usuario_id, usuario_nome, acao, descricao, dados_anteriores, dados_novos)
     VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?)`,
    [empresaId, unidadeId, vagaId, autor?.id ?? 0, autor?.nome ?? 'Sistema', acao, descricao, dadosNovos ? JSON.stringify(dadosNovos) : null]
  );
}

/** Situação de uma vaga: quantidade contratada, ocupada (alocações ativas), posições em aberto e pedidos pendentes. */
async function situacaoVaga(conexao, vagaId) {
  const [[v]] = await conexao.query(
    `SELECT pv.id, pv.cargo, pv.quantidade, pv.ativa, pv.unidade_id, pu.nome_unidade, pu.empresa_id, e.nome_empresa,
            (SELECT COUNT(*) FROM ra_alocacoes a WHERE a.vaga_id = pv.id AND a.status = 'ativa') AS ocupadas,
            (SELECT COUNT(*) FROM supervisao_vaga_posicoes p WHERE p.vaga_id = pv.id AND p.status = 'aberta') AS abertas,
            (SELECT COALESCE(SUM(s.quantidade), 0) FROM supervisao_solicitacoes_vaga s WHERE s.vaga_id = pv.id AND s.status = 'pendente') AS pendentes
       FROM parametro_vagas pv
       JOIN parametro_unidades pu ON pu.id = pv.unidade_id
       JOIN empresas e ON e.id = pu.empresa_id
      WHERE pv.id = ?`,
    [Number(vagaId)]
  );
  if (!v) throw erro(404, 'Vaga não encontrada no Parâmetro.');
  return { ...v, ocupadas: Number(v.ocupadas), abertas: Number(v.abertas), pendentes: Number(v.pendentes) };
}

/** Vagas do Parâmetro com a situação de cada uma (para o painel de controle e o formulário). */
export async function listarSituacaoVagas(filtros = {}, permitidos = null) {
  await inicializar();
  const params = [];
  let sql = `
    SELECT pv.id AS vaga_id, pv.cargo, pv.quantidade, pv.ativa, pv.unidade_id, pu.nome_unidade, pu.empresa_id, e.nome_empresa,
           (SELECT COUNT(*) FROM ra_alocacoes a WHERE a.vaga_id = pv.id AND a.status = 'ativa') AS ocupadas,
           (SELECT COUNT(*) FROM supervisao_vaga_posicoes p WHERE p.vaga_id = pv.id AND p.status = 'aberta') AS abertas,
           (SELECT COALESCE(SUM(s.quantidade), 0) FROM supervisao_solicitacoes_vaga s WHERE s.vaga_id = pv.id AND s.status = 'pendente') AS pendentes
      FROM parametro_vagas pv
      JOIN parametro_unidades pu ON pu.id = pv.unidade_id
      JOIN empresas e ON e.id = pu.empresa_id
     WHERE pu.ativa = 1`;
  if (filtros.empresaId) { sql += ' AND pu.empresa_id = ?'; params.push(Number(filtros.empresaId)); }
  sql += ' ORDER BY e.nome_empresa, pu.nome_unidade, pv.cargo';
  const [linhas] = await pool.query(sql, params);
  return linhas
    .filter((l) => permite(permitidos, l.empresa_id))
    .map((l) => {
      const ocupadas = Number(l.ocupadas);
      return {
        ...l, ativa: !!l.ativa, ocupadas, abertas: Number(l.abertas), pendentes: Number(l.pendentes),
        sem_cooperado: Math.max(0, Number(l.quantidade) - ocupadas),
      };
    });
}

/** Lista as solicitações com as posições abertas de cada uma. */
export async function listarSolicitacoes(filtros = {}, permitidos = null) {
  await inicializar();
  const params = [];
  let sql = `
    SELECT s.*, e.nome_empresa, pu.nome_unidade, pv.cargo, pv.quantidade AS quantidade_atual
      FROM supervisao_solicitacoes_vaga s
      JOIN empresas e ON e.id = s.empresa_id
      LEFT JOIN parametro_unidades pu ON pu.id = s.unidade_id
      LEFT JOIN parametro_vagas pv ON pv.id = s.vaga_id
     WHERE 1 = 1`;
  if (filtros.status) { sql += ' AND s.status = ?'; params.push(String(filtros.status)); }
  if (filtros.empresaId) { sql += ' AND s.empresa_id = ?'; params.push(Number(filtros.empresaId)); }
  if (filtros.vagaId) { sql += ' AND s.vaga_id = ?'; params.push(Number(filtros.vagaId)); }
  sql += ` ORDER BY FIELD(s.status, 'pendente', 'aprovada', 'recusada', 'cancelada'), s.criado_em DESC LIMIT 500`;
  const [linhas] = await pool.query(sql, params);
  const visiveis = linhas.filter((l) => permite(permitidos, l.empresa_id));
  if (!visiveis.length) return [];

  const ids = visiveis.map((l) => l.id);
  const [posicoes] = await pool.query(
    `SELECT p.*, c.nome AS cooperado_nome, c.matricula
       FROM supervisao_vaga_posicoes p
       LEFT JOIN ra_candidatos c ON c.id = p.candidato_id
      WHERE p.solicitacao_id IN (?)
      ORDER BY p.solicitacao_id, p.numero`,
    [ids]
  );
  const [historico] = await pool.query(
    `SELECT * FROM supervisao_solicitacoes_vaga_historico WHERE solicitacao_id IN (?) ORDER BY criado_em DESC, id DESC`,
    [ids]
  );
  return visiveis.map((s) => ({
    ...s,
    tipo_rotulo: TIPOS_SOLICITACAO[s.tipo] ?? s.tipo,
    criado_por_perfil_rotulo: ROTULO_PERFIL[s.criado_por_perfil] ?? s.criado_por_perfil ?? null,
    decidido_por_perfil_rotulo: ROTULO_PERFIL[s.decidido_por_perfil] ?? s.decidido_por_perfil ?? null,
    posicoes: posicoes.filter((p) => p.solicitacao_id === s.id).map((p) => ({
      ...p, alterado_por_perfil_rotulo: ROTULO_PERFIL[p.alterado_por_perfil] ?? p.alterado_por_perfil ?? null,
    })),
    historico: historico.filter((h) => h.solicitacao_id === s.id).map((h) => ({
      ...h,
      acao_rotulo: ROTULO_ACAO[h.acao] ?? h.acao,
      autor_perfil_rotulo: ROTULO_PERFIL[h.autor_perfil] ?? h.autor_perfil ?? null,
    })),
  }));
}

/** Registra o pedido do cliente. Fica pendente até a Supervisão aprovar ou recusar. */
export async function criarSolicitacao(dados, autor, permitidos = null) {
  await inicializar();
  const tipo = String(dados.tipo || '');
  if (!TIPOS_SOLICITACAO[tipo]) throw erro(400, 'Informe se é aumento de quadro ou reabertura.');
  const quantidade = Number(dados.quantidade);
  if (!Number.isInteger(quantidade) || quantidade < 1 || quantidade > MAX_QUANTIDADE) {
    throw erro(400, `Quantidade deve ser um número inteiro entre 1 e ${MAX_QUANTIDADE}.`);
  }
  const motivo = String(dados.motivo || '').trim();
  if (motivo.length < 5) throw erro(400, 'Descreva o motivo do pedido (mínimo de 5 caracteres).');
  const dataSolicitacao = dataValida(dados.dataSolicitacao) ? dados.dataSolicitacao : hojeISO();
  const dataInicio = dados.dataInicioPrevista ? String(dados.dataInicioPrevista) : null;
  if (dataInicio && !dataValida(dataInicio)) throw erro(400, 'Data de início prevista inválida.');

  const v = await situacaoVaga(pool, dados.vagaId);
  if (!permite(permitidos, v.empresa_id)) throw erro(403, 'Você não tem acesso a este cliente.');
  if (!v.ativa) throw erro(400, `A vaga "${v.cargo}" está inativa no Parâmetro. Reative-a antes de solicitar novas posições.`);

  const conexao = await pool.getConnection();
  try {
    await conexao.beginTransaction();
    const [res] = await conexao.query(
      `INSERT INTO supervisao_solicitacoes_vaga
         (empresa_id, unidade_id, vaga_id, tipo, quantidade, motivo, solicitante_cliente, data_solicitacao, data_inicio_prevista,
          criado_por_id, criado_por_nome, criado_por_perfil)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [v.empresa_id, v.unidade_id, v.id, tipo, quantidade, motivo, String(dados.solicitanteCliente || '').trim() || null,
        dataSolicitacao, dataInicio, autor?.id ?? null, autor?.nome ?? null, autor?.tipoUsuario ?? null]
    );
    const descricao = `${TIPOS_SOLICITACAO[tipo]}: +${quantidade} na vaga "${v.cargo}" (${v.nome_unidade}). Motivo: ${motivo}`;
    await registrar(conexao, res.insertId, 'criada', descricao, autor);
    await logParametro(conexao, {
      empresaId: v.empresa_id, unidadeId: v.unidade_id, vagaId: v.id, autor,
      acao: 'solicitacao_vaga', descricao: `Solicitação de ${descricao}`, dadosNovos: { solicitacaoId: res.insertId, tipo, quantidade },
    });
    await conexao.commit();
    return { id: res.insertId };
  } catch (e) {
    await conexao.rollback();
    throw e;
  } finally {
    conexao.release();
  }
}

async function carregarSolicitacao(conexao, id, permitidos, { travar = false } = {}) {
  const [[s]] = await conexao.query(
    `SELECT * FROM supervisao_solicitacoes_vaga WHERE id = ?${travar ? ' FOR UPDATE' : ''}`,
    [Number(id)]
  );
  if (!s) throw erro(404, 'Solicitação não encontrada.');
  if (!permite(permitidos, s.empresa_id)) throw erro(403, 'Você não tem acesso a este cliente.');
  return s;
}

/**
 * Aprova: no aumento de quadro, sobe a quantidade da vaga no Parâmetro (incremento + log); nas duas
 * modalidades, abre N posições na vaga para a Supervisão acompanhar o preenchimento.
 */
export async function aprovarSolicitacao(id, dados, autor, permitidos = null) {
  await inicializar();
  const conexao = await pool.getConnection();
  try {
    await conexao.beginTransaction();
    const s = await carregarSolicitacao(conexao, id, permitidos, { travar: true });
    if (s.status !== 'pendente') throw erro(409, 'Esta solicitação já foi decidida.');
    const [[vaga]] = await conexao.query('SELECT id, cargo, quantidade, ativa FROM parametro_vagas WHERE id = ? FOR UPDATE', [s.vaga_id]);
    if (!vaga) throw erro(404, 'A vaga desta solicitação não existe mais no Parâmetro.');
    if (!vaga.ativa) throw erro(400, `A vaga "${vaga.cargo}" está inativa no Parâmetro.`);

    const qtdAnterior = Number(vaga.quantidade);
    let qtdNova = qtdAnterior;
    if (s.tipo === 'aumento_quadro') {
      qtdNova = qtdAnterior + Number(s.quantidade);
      await conexao.query('UPDATE parametro_vagas SET quantidade = ? WHERE id = ?', [qtdNova, vaga.id]);
      await conexao.query(
        `INSERT INTO parametro_incrementos
           (vaga_id, quantidade_anterior, quantidade_nova, motivo, registrado_por_id, registrado_por_nome, data_incremento)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [vaga.id, qtdAnterior, qtdNova, `Solicitação nº ${s.id}: ${s.motivo}`, autor?.id ?? 0, autor?.nome ?? 'Sistema', hojeISO()]
      );
      await logParametro(conexao, {
        empresaId: s.empresa_id, unidadeId: s.unidade_id, vagaId: vaga.id, autor, acao: 'incremento_vaga',
        descricao: `Alterou quantidade da vaga "${vaga.cargo}": ${qtdAnterior} → ${qtdNova} (+${s.quantidade}) — solicitação nº ${s.id} aprovada pela Supervisão`,
        dadosNovos: { solicitacaoId: s.id, delta: Number(s.quantidade) },
      });
    } else {
      // Reabertura só repõe posições previstas e sem cooperado (quantidade − ocupadas − já abertas)
      const [[{ ocupadas }]] = await conexao.query(
        `SELECT COUNT(*) AS ocupadas FROM ra_alocacoes WHERE vaga_id = ? AND status = 'ativa'`, [vaga.id]
      );
      const [[{ abertas }]] = await conexao.query(
        `SELECT COUNT(*) AS abertas FROM supervisao_vaga_posicoes WHERE vaga_id = ? AND status = 'aberta'`, [vaga.id]
      );
      const livres = qtdAnterior - Number(ocupadas) - Number(abertas);
      if (Number(s.quantidade) > livres) {
        throw erro(400, `A vaga "${vaga.cargo}" tem ${qtdAnterior} posição(ões), ${ocupadas} ocupada(s) e ${abertas} já em aberto: `
          + `só é possível reabrir ${Math.max(0, livres)}. Para passar disso, use "Aumento de quadro".`);
      }
      await logParametro(conexao, {
        empresaId: s.empresa_id, unidadeId: s.unidade_id, vagaId: vaga.id, autor, acao: 'reabertura_vaga',
        descricao: `Reabriu ${s.quantidade} posição(ões) da vaga "${vaga.cargo}" — solicitação nº ${s.id} aprovada pela Supervisão`,
        dadosNovos: { solicitacaoId: s.id, quantidade: Number(s.quantidade) },
      });
    }

    const [[{ ultimo }]] = await conexao.query(
      `SELECT COALESCE(MAX(numero), 0) AS ultimo FROM supervisao_vaga_posicoes WHERE vaga_id = ?`, [vaga.id]
    );
    for (let i = 1; i <= Number(s.quantidade); i += 1) {
      await conexao.query(
        `INSERT INTO supervisao_vaga_posicoes (solicitacao_id, vaga_id, numero) VALUES (?, ?, ?)`,
        [s.id, vaga.id, Number(ultimo) + i]
      );
    }
    const observacao = String(dados?.observacao || '').trim() || null;
    await conexao.query(
      `UPDATE supervisao_solicitacoes_vaga
          SET status = 'aprovada', quantidade_anterior = ?, quantidade_nova = ?, observacao_decisao = ?,
              decidido_por_id = ?, decidido_por_nome = ?, decidido_por_perfil = ?, decidido_em = NOW()
        WHERE id = ?`,
      [qtdAnterior, qtdNova, observacao, autor?.id ?? null, autor?.nome ?? null, autor?.tipoUsuario ?? null, s.id]
    );
    const desc = s.tipo === 'aumento_quadro'
      ? `Quantidade da vaga "${vaga.cargo}": ${qtdAnterior} → ${qtdNova}. ${s.quantidade} posição(ões) aberta(s).`
      : `${s.quantidade} posição(ões) reaberta(s) na vaga "${vaga.cargo}".`;
    await registrar(conexao, s.id, 'aprovada', observacao ? `${desc} Obs.: ${observacao}` : desc, autor);
    await conexao.commit();
    return { id: s.id, quantidadeAnterior: qtdAnterior, quantidadeNova: qtdNova };
  } catch (e) {
    await conexao.rollback();
    throw e;
  } finally {
    conexao.release();
  }
}

/** Recusa (Supervisão) ou cancela (pedido retirado) uma solicitação pendente. Exige justificativa. */
export async function encerrarSolicitacao(id, status, dados, autor, permitidos = null) {
  await inicializar();
  if (!['recusada', 'cancelada'].includes(status)) throw erro(400, 'Ação inválida.');
  const observacao = String(dados?.observacao || '').trim();
  if (observacao.length < 5) throw erro(400, 'Informe a justificativa (mínimo de 5 caracteres).');
  const conexao = await pool.getConnection();
  try {
    await conexao.beginTransaction();
    const s = await carregarSolicitacao(conexao, id, permitidos, { travar: true });
    if (s.status !== 'pendente') throw erro(409, 'Esta solicitação já foi decidida.');
    await conexao.query(
      `UPDATE supervisao_solicitacoes_vaga
          SET status = ?, observacao_decisao = ?, decidido_por_id = ?, decidido_por_nome = ?, decidido_por_perfil = ?, decidido_em = NOW()
        WHERE id = ?`,
      [status, observacao, autor?.id ?? null, autor?.nome ?? null, autor?.tipoUsuario ?? null, s.id]
    );
    await registrar(conexao, s.id, status, observacao, autor);
    await conexao.commit();
    return { id: s.id, status };
  } catch (e) {
    await conexao.rollback();
    throw e;
  } finally {
    conexao.release();
  }
}

/** Cooperados alocados (RA) na vaga da posição e ainda não vinculados a outra posição preenchida. */
export async function listarCandidatosPosicao(posicaoId, permitidos = null) {
  await inicializar();
  const [[p]] = await pool.query(
    `SELECT p.*, s.empresa_id FROM supervisao_vaga_posicoes p JOIN supervisao_solicitacoes_vaga s ON s.id = p.solicitacao_id WHERE p.id = ?`,
    [Number(posicaoId)]
  );
  if (!p) throw erro(404, 'Posição não encontrada.');
  if (!permite(permitidos, p.empresa_id)) throw erro(403, 'Você não tem acesso a este cliente.');
  const [linhas] = await pool.query(
    `SELECT c.id, c.nome, c.matricula, a.data_inicio
       FROM ra_alocacoes a
       JOIN ra_candidatos c ON c.id = a.candidato_id
      WHERE a.vaga_id = ? AND a.status = 'ativa'
        AND c.id NOT IN (SELECT candidato_id FROM supervisao_vaga_posicoes WHERE vaga_id = ? AND status = 'preenchida' AND candidato_id IS NOT NULL)
      ORDER BY c.nome`,
    [p.vaga_id, p.vaga_id]
  );
  return linhas;
}

/** Preenche (cooperado já alocado na vaga pelo RA), cancela ou reabre uma posição. */
export async function alterarPosicao(posicaoId, acao, dados, autor, permitidos = null) {
  await inicializar();
  const conexao = await pool.getConnection();
  try {
    await conexao.beginTransaction();
    const [[p]] = await conexao.query(
      `SELECT p.*, s.empresa_id, s.unidade_id, pv.cargo
         FROM supervisao_vaga_posicoes p
         JOIN supervisao_solicitacoes_vaga s ON s.id = p.solicitacao_id
         LEFT JOIN parametro_vagas pv ON pv.id = p.vaga_id
        WHERE p.id = ? FOR UPDATE`,
      [Number(posicaoId)]
    );
    if (!p) throw erro(404, 'Posição não encontrada.');
    if (!permite(permitidos, p.empresa_id)) throw erro(403, 'Você não tem acesso a este cliente.');
    const observacao = String(dados?.observacao || '').trim() || null;
    const rotulo = `Posição ${p.numero} da vaga "${p.cargo}"`;
    let descricao;

    if (acao === 'preencher') {
      if (p.status !== 'aberta') throw erro(409, 'Só é possível preencher uma posição em aberto.');
      const candidatoId = Number(dados?.candidatoId);
      const [[c]] = await conexao.query(
        `SELECT c.id, c.nome FROM ra_alocacoes a JOIN ra_candidatos c ON c.id = a.candidato_id
          WHERE a.vaga_id = ? AND a.status = 'ativa' AND c.id = ? LIMIT 1`,
        [p.vaga_id, candidatoId]
      );
      if (!c) throw erro(400, 'O cooperado precisa estar alocado nesta vaga (RA) para preencher a posição.');
      const [[jaUsado]] = await conexao.query(
        `SELECT id FROM supervisao_vaga_posicoes WHERE vaga_id = ? AND candidato_id = ? AND status = 'preenchida' LIMIT 1`,
        [p.vaga_id, c.id]
      );
      if (jaUsado) throw erro(409, `${c.nome} já preenche outra posição desta vaga.`);
      await conexao.query(
        `UPDATE supervisao_vaga_posicoes SET status = 'preenchida', candidato_id = ?, observacao = ?,
                alterado_por_nome = ?, alterado_por_perfil = ?, alterado_em = NOW() WHERE id = ?`,
        [c.id, observacao, autor?.nome ?? null, autor?.tipoUsuario ?? null, p.id]
      );
      descricao = `${rotulo} preenchida por ${c.nome}.`;
    } else if (acao === 'cancelar') {
      if (p.status !== 'aberta') throw erro(409, 'Só é possível cancelar uma posição em aberto.');
      if (!observacao || observacao.length < 5) throw erro(400, 'Informe o motivo do cancelamento (mínimo de 5 caracteres).');
      await conexao.query(
        `UPDATE supervisao_vaga_posicoes SET status = 'cancelada', observacao = ?,
                alterado_por_nome = ?, alterado_por_perfil = ?, alterado_em = NOW() WHERE id = ?`,
        [observacao, autor?.nome ?? null, autor?.tipoUsuario ?? null, p.id]
      );
      descricao = `${rotulo} cancelada. Motivo: ${observacao}`;
    } else if (acao === 'reabrir') {
      if (p.status === 'aberta') throw erro(409, 'A posição já está em aberto.');
      await conexao.query(
        `UPDATE supervisao_vaga_posicoes SET status = 'aberta', candidato_id = NULL, observacao = ?,
                alterado_por_nome = ?, alterado_por_perfil = ?, alterado_em = NOW() WHERE id = ?`,
        [observacao, autor?.nome ?? null, autor?.tipoUsuario ?? null, p.id]
      );
      descricao = `${rotulo} reaberta${observacao ? `. Motivo: ${observacao}` : '.'}`;
    } else {
      throw erro(400, 'Ação inválida.');
    }

    const acaoHist = { preencher: 'posicao_preenchida', cancelar: 'posicao_cancelada', reabrir: 'posicao_reaberta' }[acao];
    await registrar(conexao, p.solicitacao_id, acaoHist, descricao, autor, p.id);
    await conexao.commit();
    return { id: p.id };
  } catch (e) {
    await conexao.rollback();
    throw e;
  } finally {
    conexao.release();
  }
}
