// ── Processo de Faturamento: estrutura, apuração, conferência e auditoria ───
// Tabelas novas (não alteram as existentes):
//  • faturamento_processos     → um processo por cliente × competência (× unidade/ficha opcional)
//  • faturamento_itens         → apuração: uma linha por alocação (mesmo cálculo da planilha de faturamento)
//  • faturamento_ajustes       → correções manuais de um campo do item, com motivo
//  • faturamento_divergencias  → divergências automáticas ou registradas na conferência
//  • faturamento_auditoria     → histórico de todas as ações do processo
//
// A apuração NÃO cria fórmulas novas: reutiliza gerarPlanilhaFaturamento (horas dos apontamentos,
// plantões da escala, complementos da supervisão e valores importados do cliente). Valores em R$
// (preço por hora/plantão, DSR, insalubridade, VR/VT etc.) dependem de regras ainda não confirmadas
// pela ATESA: os parâmetros da vaga são guardados apenas como referência, sem cálculo.
// Emissão de NF, cobrança e pagamentos ficam fora deste módulo por enquanto.
import { pool } from '../config/database.js';
import { gerarPlanilhaFaturamento } from './escalaFaturamentoRepository.js';

export const STATUS_PROCESSO = ['aberto', 'apurado', 'aprovado', 'rejeitado', 'cancelado'];
export const STATUS_ITEM = ['pendente', 'conferido', 'divergente'];

// Campos quantitativos do item que podem ser conferidos/ajustados (todos vêm da planilha atual)
export const CAMPOS_APURACAO = [
  'dias_mes_fechado', 'dias_trabalhados', 'total_horas', 'horas_apontadas', 'horas_escala',
  'pl_diurno', 'pl_noturno', 'hora_excedente', 'ad_noturno',
  'bonificacao', 'desc_refeicao', 'desc_estacionamento', 'desc_farmacia', 'reembolso',
];
// Horas apontadas / horas da escala são a origem da conferência: não são ajustáveis
export const CAMPOS_AJUSTAVEIS = CAMPOS_APURACAO.filter((c) => c !== 'horas_apontadas' && c !== 'horas_escala');

// Parâmetros da vaga guardados como referência na apuração (nenhum cálculo em R$ é feito com eles)
const CAMPOS_PARAMETRO_VAGA = [
  'salario_base', 'tipo_escala', 'recebe_por', 'adicional_noturno', 'periculosidade', 'insalubridade',
  'premio_incentivo', 'valor_vr_dia', 'valor_vt_dia', 'dsr_percentual', 'desconta_pausa', 'desconta_refeicao',
];

// Regras que dependem de confirmação da ATESA — exibidas na tela e não aplicadas como definitivas
export const REGRAS_PENDENTES = [
  'Valor em R$ do faturamento (preço de venda por hora, plantão ou mês) não está cadastrado; a apuração é só de quantidades e dos valores enviados pelo cliente.',
  'DSR, insalubridade, periculosidade, prêmio incentivo e VR/VT da vaga aparecem apenas como referência, sem cálculo.',
  'Adicional noturno: usa somente as horas lançadas como complemento pela Supervisão (não aplica a regra legal 22h–5h nem a classificação de turno da escala).',
  'Hora excedente: usa os complementos da Supervisão (hora adicional/extra menos desconto); não compara com a jornada contratada.',
  'Período de apuração: mês civil da competência; o período informado na ficha da unidade (ex.: "05 a 30") ainda não é aplicado.',
  'Divergência de horas: qualquer diferença entre horas apontadas e horas da escala é sinalizada (tolerância não definida).',
  'Centro de custo: não há cadastro no sistema; o campo é preenchido manualmente no processo.',
];

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

function erro(status, msg) {
  return Object.assign(new Error(msg), { status });
}

let inicializado = null;
export function inicializarTabelasFaturamentoProcesso() {
  if (!inicializado) {
    inicializado = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS faturamento_processos (
          id INT AUTO_INCREMENT PRIMARY KEY,
          codigo VARCHAR(30) NULL,
          competencia CHAR(7) NOT NULL,
          empresa_id INT NOT NULL,
          unidade_id INT NULL,
          cooperativa VARCHAR(150) NULL,
          centro_custo VARCHAR(100) NULL,
          periodo_inicio DATE NOT NULL,
          periodo_fim DATE NOT NULL,
          status ENUM('aberto','apurado','aprovado','rejeitado','cancelado') NOT NULL DEFAULT 'aberto',
          chave_ativa VARCHAR(40) NULL,
          versao_apuracao INT NOT NULL DEFAULT 0,
          observacao TEXT NULL,
          motivo_status TEXT NULL,
          criado_por_id INT NULL,
          criado_por_nome VARCHAR(150) NULL,
          criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          apurado_por_id INT NULL,
          apurado_por_nome VARCHAR(150) NULL,
          apurado_em DATETIME NULL,
          aprovado_por_id INT NULL,
          aprovado_por_nome VARCHAR(150) NULL,
          aprovado_em DATETIME NULL,
          atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          UNIQUE KEY uk_fatp_codigo (codigo),
          UNIQUE KEY uk_fatp_chave_ativa (chave_ativa),
          INDEX idx_fatp_comp_emp (competencia, empresa_id),
          INDEX idx_fatp_status (status)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS faturamento_itens (
          id INT AUTO_INCREMENT PRIMARY KEY,
          processo_id INT NOT NULL,
          versao INT NOT NULL,
          chave_item VARCHAR(30) NOT NULL,
          alocacao_id INT NULL,
          candidato_id INT NOT NULL,
          unidade_id INT NULL,
          vaga_id INT NULL,
          cooperado_nome VARCHAR(200) NULL,
          matricula VARCHAR(20) NULL,
          atividade VARCHAR(200) NULL,
          local VARCHAR(200) NULL,
          tipo_escala VARCHAR(30) NULL,
          data_inicio DATE NULL,
          desligamento DATE NULL,
          dias_mes_total INT NOT NULL DEFAULT 30,
          dias_mes_fechado DECIMAL(8,2) NOT NULL DEFAULT 0,
          dias_trabalhados DECIMAL(8,2) NOT NULL DEFAULT 0,
          total_horas DECIMAL(10,2) NOT NULL DEFAULT 0,
          horas_apontadas DECIMAL(10,2) NOT NULL DEFAULT 0,
          horas_escala DECIMAL(10,2) NOT NULL DEFAULT 0,
          pl_diurno DECIMAL(8,2) NOT NULL DEFAULT 0,
          pl_noturno DECIMAL(8,2) NOT NULL DEFAULT 0,
          hora_excedente DECIMAL(10,2) NOT NULL DEFAULT 0,
          ad_noturno DECIMAL(10,2) NOT NULL DEFAULT 0,
          bonificacao DECIMAL(12,2) NOT NULL DEFAULT 0,
          desc_refeicao DECIMAL(12,2) NOT NULL DEFAULT 0,
          desc_estacionamento DECIMAL(12,2) NOT NULL DEFAULT 0,
          desc_farmacia DECIMAL(12,2) NOT NULL DEFAULT 0,
          reembolso DECIMAL(12,2) NOT NULL DEFAULT 0,
          parametros_vaga TEXT NULL,
          status ENUM('pendente','conferido','divergente') NOT NULL DEFAULT 'pendente',
          conferido_por_id INT NULL,
          conferido_por_nome VARCHAR(150) NULL,
          conferido_em DATETIME NULL,
          criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE KEY uk_fati_proc_chave (processo_id, chave_item),
          INDEX idx_fati_cand (candidato_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS faturamento_ajustes (
          id INT AUTO_INCREMENT PRIMARY KEY,
          processo_id INT NOT NULL,
          chave_item VARCHAR(30) NOT NULL,
          campo VARCHAR(40) NOT NULL,
          valor DECIMAL(12,2) NOT NULL,
          motivo TEXT NOT NULL,
          criado_por_id INT NULL,
          criado_por_nome VARCHAR(150) NULL,
          criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE KEY uk_fata_proc_item_campo (processo_id, chave_item, campo)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS faturamento_divergencias (
          id INT AUTO_INCREMENT PRIMARY KEY,
          processo_id INT NOT NULL,
          chave_item VARCHAR(30) NULL,
          origem ENUM('automatica','manual') NOT NULL,
          tipo VARCHAR(40) NOT NULL,
          descricao TEXT NOT NULL,
          status ENUM('aberta','resolvida','descartada') NOT NULL DEFAULT 'aberta',
          resolucao TEXT NULL,
          criado_por_id INT NULL,
          criado_por_nome VARCHAR(150) NULL,
          criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          resolvido_por_id INT NULL,
          resolvido_por_nome VARCHAR(150) NULL,
          resolvido_em DATETIME NULL,
          INDEX idx_fatd_proc (processo_id, status)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS faturamento_auditoria (
          id INT AUTO_INCREMENT PRIMARY KEY,
          processo_id INT NOT NULL,
          chave_item VARCHAR(30) NULL,
          acao VARCHAR(40) NOT NULL,
          campo VARCHAR(60) NULL,
          valor_anterior TEXT NULL,
          valor_novo TEXT NULL,
          motivo TEXT NULL,
          usuario_id INT NULL,
          usuario_nome VARCHAR(150) NULL,
          usuario_perfil VARCHAR(50) NULL,
          ip VARCHAR(45) NULL,
          criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_fataud_proc (processo_id, criado_em)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);
    })().catch((err) => {
      inicializado = null;
      console.error('[faturamentoProcesso] Erro ao criar tabelas:', err?.message);
      throw err;
    });
  }
  return inicializado;
}
// Tabelas criadas no primeiro uso (cada função chama inicializarTabelasFaturamentoProcesso)

// ── Regras puras (testáveis sem banco) ──────────────────────────────────────
export function chaveItem(linha) {
  return linha.alocacao_id ? `A${linha.alocacao_id}` : `C${linha.candidato_id}`;
}

export function chaveAtiva(competencia, empresaId, unidadeId) {
  return `${competencia}|${Number(empresaId)}|${Number(unidadeId) || 0}`;
}

export function codigoProcesso(competencia, id) {
  return `FAT-${competencia.replace('-', '')}-${String(id).padStart(6, '0')}`;
}

/** Linhas da planilha que pertencem ao escopo do processo (empresa inteira ou uma unidade/ficha). */
export function filtrarLinhasDoEscopo(linhas, unidadeId) {
  if (!unidadeId) return linhas;
  return linhas.filter((l) => Number(l.unidade_id) === Number(unidadeId));
}

/**
 * Divergências detectadas automaticamente: somente fatos observáveis nos dados, sem fórmula de valor.
 */
export function detectarDivergencias(itens) {
  const lista = [];
  for (const it of itens) {
    const chave = chaveItem(it);
    if (!it.alocacao_id) {
      lista.push({
        chave_item: chave,
        tipo: 'valor_cliente_sem_alocacao',
        descricao: `${it.cooperado} (mat. ${it.matricula || '—'}) tem valores enviados pelo cliente, mas não tem alocação nesta empresa na competência.`,
      });
      continue;
    }
    const ap = r2(it.horas_apontadas);
    const esc = r2(it.horas_escala);
    if (ap > 0 && esc > 0 && ap !== esc) {
      lista.push({
        chave_item: chave,
        tipo: 'horas_apontamento_x_escala',
        descricao: `Horas apontadas (${ap}) diferentes das horas da escala (${esc}): diferença de ${r2(ap - esc)} h.`,
      });
    }
    if (ap === 0 && esc === 0 && Number(it.dias_trabalhados) === 0) {
      lista.push({
        chave_item: chave,
        tipo: 'sem_jornada',
        descricao: `${it.cooperado} está alocado(a) na competência, mas não há apontamentos nem escalas.`,
      });
    }
  }
  return lista;
}

/** Valores finais do item: valor apurado, substituído pelo ajuste manual quando houver. */
export function aplicarAjustes(item, ajustes) {
  const finais = {};
  for (const c of CAMPOS_APURACAO) finais[c] = r2(item[c]);
  for (const a of ajustes) if (CAMPOS_AJUSTAVEIS.includes(a.campo)) finais[a.campo] = r2(a.valor);
  return finais;
}

/** Totais do processo a partir dos valores finais dos itens. */
export function totalizar(itens) {
  const totais = Object.fromEntries(CAMPOS_APURACAO.map((c) => [c, 0]));
  for (const it of itens) for (const c of CAMPOS_APURACAO) totais[c] = r2(totais[c] + (Number(it.valores_finais?.[c] ?? it[c]) || 0));
  return totais;
}

/** Pode aprovar? Devolve a lista de impedimentos (vazia = pode). */
export function impedimentosAprovacao(processo, itens, divergenciasAbertas) {
  const imp = [];
  if (processo.status !== 'apurado') imp.push(`O processo está "${processo.status}"; só é possível aprovar uma apuração em conferência.`);
  if (itens.length === 0) imp.push('A apuração não possui itens.');
  const naoConferidos = itens.filter((i) => i.status !== 'conferido').length;
  if (naoConferidos) imp.push(`${naoConferidos} item(ns) ainda não conferido(s).`);
  if (divergenciasAbertas) imp.push(`${divergenciasAbertas} divergência(s) em aberto.`);
  return imp;
}

// ── Auditoria ────────────────────────────────────────────────────────────────
async function auditar(conn, processoId, usuario, acao, { chaveItem: chave = null, campo = null, anterior = null, novo = null, motivo = null } = {}) {
  const txt = (v) => (v === null || v === undefined ? null : typeof v === 'object' ? JSON.stringify(v) : String(v));
  await conn.query(
    `INSERT INTO faturamento_auditoria
       (processo_id, chave_item, acao, campo, valor_anterior, valor_novo, motivo, usuario_id, usuario_nome, usuario_perfil, ip)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [processoId, chave, acao, campo, txt(anterior), txt(novo), motivo, usuario.id ?? null, usuario.nome ?? null,
      usuario.perfil ?? null, usuario.ip ?? null]
  );
}

async function emTransacao(fn) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const r = await fn(conn);
    await conn.commit();
    return r;
  } catch (err) {
    await conn.rollback().catch(() => {});
    throw err;
  } finally {
    conn.release();
  }
}

async function carregarProcesso(conn, id, { bloquear = false } = {}) {
  const [[p]] = await conn.query(`SELECT * FROM faturamento_processos WHERE id = ?${bloquear ? ' FOR UPDATE' : ''}`, [Number(id)]);
  if (!p) throw erro(404, 'Processo de faturamento não encontrado.');
  return p;
}

function exigirStatus(processo, permitidos, acao) {
  if (!permitidos.includes(processo.status)) {
    throw erro(409, `Não é possível ${acao}: o processo está "${processo.status}".`);
  }
}

function texto(v, max) {
  const s = String(v ?? '').trim();
  return s ? s.slice(0, max) : null;
}

// ── Processos ────────────────────────────────────────────────────────────────
export async function listarUnidadesFaturamento({ empresaId } = {}) {
  if (!empresaId) return [];
  const [rows] = await pool.query(
    `SELECT id, empresa_id, nome_unidade, ativa, periodo_apuracao, apresentacao_faturamento, vencimento
       FROM parametro_unidades WHERE empresa_id = ? ORDER BY nome_unidade`,
    [Number(empresaId)]
  );
  return rows;
}

export async function listarProcessos({ competencia, empresaId, status } = {}) {
  await inicializarTabelasFaturamentoProcesso();
  let sql = `
    SELECT p.*, e.nome_empresa, u.nome_unidade,
           (SELECT COUNT(*) FROM faturamento_itens i WHERE i.processo_id = p.id) AS total_itens,
           (SELECT COUNT(*) FROM faturamento_itens i WHERE i.processo_id = p.id AND i.status = 'conferido') AS itens_conferidos,
           (SELECT COUNT(*) FROM faturamento_divergencias d WHERE d.processo_id = p.id AND d.status = 'aberta') AS divergencias_abertas
      FROM faturamento_processos p
      JOIN empresas e ON e.id = p.empresa_id
      LEFT JOIN parametro_unidades u ON u.id = p.unidade_id
     WHERE 1=1`;
  const params = [];
  if (competencia) { sql += ' AND p.competencia = ?'; params.push(competencia); }
  if (empresaId) { sql += ' AND p.empresa_id = ?'; params.push(Number(empresaId)); }
  if (status) { sql += ' AND p.status = ?'; params.push(status); }
  sql += ' ORDER BY p.competencia DESC, e.nome_empresa, u.nome_unidade LIMIT 500';
  const [rows] = await pool.query(sql, params);
  return rows;
}

export async function criarProcesso(dados, usuario) {
  await inicializarTabelasFaturamentoProcesso();
  const competencia = String(dados.competencia || '');
  const m = /^(\d{4})-(\d{2})$/.exec(competencia);
  if (!m || Number(m[2]) < 1 || Number(m[2]) > 12) throw erro(400, 'Competência inválida. Use o formato AAAA-MM.');
  const empresaId = Number(dados.empresaId);
  if (!empresaId) throw erro(400, 'Selecione o cliente (empresa).');
  const unidadeId = dados.unidadeId ? Number(dados.unidadeId) : null;

  const [[empresa]] = await pool.query(`SELECT id, nome_empresa, cooperativa FROM empresas WHERE id = ?`, [empresaId]);
  if (!empresa) throw erro(404, 'Empresa não encontrada.');
  if (unidadeId) {
    const [[u]] = await pool.query(`SELECT id FROM parametro_unidades WHERE id = ? AND empresa_id = ?`, [unidadeId, empresaId]);
    if (!u) throw erro(400, 'A unidade (ficha) informada não pertence a este cliente.');
  }

  // Um processo para a empresa inteira não convive com processos por unidade (e vice-versa)
  const [ativos] = await pool.query(
    `SELECT id, codigo, unidade_id FROM faturamento_processos
      WHERE competencia = ? AND empresa_id = ? AND status <> 'cancelado'`,
    [competencia, empresaId]
  );
  const conflito = ativos.find((p) => !unidadeId || !p.unidade_id || Number(p.unidade_id) === unidadeId);
  if (conflito) {
    throw erro(409, `Já existe o processo ${conflito.codigo} para este cliente e competência${conflito.unidade_id ? ' nesta unidade' : ' (empresa inteira)'}. Cancele-o antes de criar outro.`);
  }

  const ultimoDia = new Date(Number(m[1]), Number(m[2]), 0).getDate();
  const centroCusto = texto(dados.centroCusto, 100);
  const observacao = texto(dados.observacao, 5000);

  return emTransacao(async (conn) => {
    let res;
    try {
      [res] = await conn.query(
        `INSERT INTO faturamento_processos
           (competencia, empresa_id, unidade_id, cooperativa, centro_custo, periodo_inicio, periodo_fim, status, chave_ativa,
            observacao, criado_por_id, criado_por_nome)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'aberto', ?, ?, ?, ?)`,
        [competencia, empresaId, unidadeId, empresa.cooperativa ?? null, centroCusto, `${competencia}-01`,
          `${competencia}-${String(ultimoDia).padStart(2, '0')}`, chaveAtiva(competencia, empresaId, unidadeId),
          observacao, usuario.id ?? null, usuario.nome ?? null]
      );
    } catch (err) {
      if (err?.code === 'ER_DUP_ENTRY') throw erro(409, 'Já existe um processo ativo para este cliente, unidade e competência.');
      throw err;
    }
    const id = res.insertId;
    const codigo = codigoProcesso(competencia, id);
    await conn.query(`UPDATE faturamento_processos SET codigo = ? WHERE id = ?`, [codigo, id]);
    await auditar(conn, id, usuario, 'criacao', {
      novo: { codigo, competencia, empresa_id: empresaId, unidade_id: unidadeId, cooperativa: empresa.cooperativa ?? null, centro_custo: centroCusto },
    });
    return { ok: true, id, codigo };
  });
}

export async function atualizarProcesso(id, dados, usuario) {
  await inicializarTabelasFaturamentoProcesso();
  return emTransacao(async (conn) => {
    const p = await carregarProcesso(conn, id, { bloquear: true });
    exigirStatus(p, ['aberto', 'apurado', 'rejeitado'], 'alterar o processo');
    const novos = {};
    if ('centroCusto' in dados) novos.centro_custo = texto(dados.centroCusto, 100);
    if ('observacao' in dados) novos.observacao = texto(dados.observacao, 5000);
    const campos = Object.keys(novos).filter((c) => (p[c] ?? null) !== novos[c]);
    if (!campos.length) return { ok: true, id: p.id };
    await conn.query(
      `UPDATE faturamento_processos SET ${campos.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`,
      [...campos.map((c) => novos[c]), p.id]
    );
    for (const c of campos) await auditar(conn, p.id, usuario, 'edicao', { campo: c, anterior: p[c], novo: novos[c] });
    return { ok: true, id: p.id };
  });
}

export async function obterProcesso(id) {
  await inicializarTabelasFaturamentoProcesso();
  const [[p]] = await pool.query(
    `SELECT p.*, e.nome_empresa, e.cnpj, u.nome_unidade, u.periodo_apuracao, u.apresentacao_faturamento, u.vencimento
       FROM faturamento_processos p
       JOIN empresas e ON e.id = p.empresa_id
       LEFT JOIN parametro_unidades u ON u.id = p.unidade_id
      WHERE p.id = ?`,
    [Number(id)]
  );
  if (!p) throw erro(404, 'Processo de faturamento não encontrado.');
  const [itens] = await pool.query(`SELECT * FROM faturamento_itens WHERE processo_id = ? ORDER BY cooperado_nome, data_inicio`, [p.id]);
  const [ajustes] = await pool.query(`SELECT * FROM faturamento_ajustes WHERE processo_id = ? ORDER BY criado_em`, [p.id]);
  const [divergencias] = await pool.query(
    `SELECT * FROM faturamento_divergencias WHERE processo_id = ? ORDER BY status = 'aberta' DESC, criado_em`,
    [p.id]
  );

  const ajustesPorItem = new Map();
  for (const a of ajustes) {
    if (!ajustesPorItem.has(a.chave_item)) ajustesPorItem.set(a.chave_item, []);
    ajustesPorItem.get(a.chave_item).push(a);
  }
  const itensMontados = itens.map((it) => {
    const aj = ajustesPorItem.get(it.chave_item) || [];
    let parametros = null;
    try { parametros = it.parametros_vaga ? JSON.parse(it.parametros_vaga) : null; } catch { parametros = null; }
    return { ...it, parametros_vaga: parametros, ajustes: aj, valores_finais: aplicarAjustes(it, aj) };
  });
  const abertas = divergencias.filter((d) => d.status === 'aberta').length;

  return {
    processo: p,
    itens: itensMontados,
    divergencias,
    totais: totalizar(itensMontados),
    impedimentos_aprovacao: impedimentosAprovacao(p, itensMontados, abertas),
    regras_pendentes: REGRAS_PENDENTES,
  };
}

// ── Apuração ─────────────────────────────────────────────────────────────────
export async function apurarProcesso(id, usuario) {
  await inicializarTabelasFaturamentoProcesso();
  const [[atual]] = await pool.query(`SELECT * FROM faturamento_processos WHERE id = ?`, [Number(id)]);
  if (!atual) throw erro(404, 'Processo de faturamento não encontrado.');
  exigirStatus(atual, ['aberto', 'apurado', 'rejeitado'], 'apurar');

  // Mesmo cálculo da planilha de faturamento (sem fórmulas novas)
  const planilha = await gerarPlanilhaFaturamento({ empresaId: atual.empresa_id, competencia: atual.competencia });
  const linhas = filtrarLinhasDoEscopo(planilha.linhas, atual.unidade_id);

  const vagaIds = [...new Set(linhas.map((l) => l.vaga_id).filter(Boolean))];
  const vagas = new Map();
  if (vagaIds.length) {
    const [rows] = await pool.query(`SELECT id, ${CAMPOS_PARAMETRO_VAGA.join(', ')} FROM parametro_vagas WHERE id IN (?)`, [vagaIds]);
    for (const v of rows) vagas.set(v.id, Object.fromEntries(CAMPOS_PARAMETRO_VAGA.map((c) => [c, v[c] ?? null])));
  }
  const divergenciasAuto = detectarDivergencias(linhas);

  return emTransacao(async (conn) => {
    const p = await carregarProcesso(conn, id, { bloquear: true });
    exigirStatus(p, ['aberto', 'apurado', 'rejeitado'], 'apurar');
    const versao = Number(p.versao_apuracao) + 1;

    // Conferências anteriores são refeitas: a apuração pode ter mudado
    await conn.query(`DELETE FROM faturamento_itens WHERE processo_id = ?`, [p.id]);
    await conn.query(`DELETE FROM faturamento_divergencias WHERE processo_id = ? AND origem = 'automatica'`, [p.id]);

    if (linhas.length) {
      const cols = ['processo_id', 'versao', 'chave_item', 'alocacao_id', 'candidato_id', 'unidade_id', 'vaga_id',
        'cooperado_nome', 'matricula', 'atividade', 'local', 'tipo_escala', 'data_inicio', 'desligamento', 'dias_mes_total',
        ...CAMPOS_APURACAO, 'parametros_vaga', 'status'];
      const valores = linhas.map((l) => [
        p.id, versao, chaveItem(l), l.alocacao_id ?? null, l.candidato_id, l.unidade_id ?? null, l.vaga_id ?? null,
        l.cooperado ?? null, l.matricula ?? null, l.atividade || null, l.local || null, l.tipo_escala ?? null,
        l.data_inicio ?? null, l.desligamento ?? null, Number(l.dias_mes_total) || 30,
        ...CAMPOS_APURACAO.map((c) => r2(l[c])),
        l.vaga_id && vagas.has(l.vaga_id) ? JSON.stringify(vagas.get(l.vaga_id)) : null,
        'pendente',
      ]);
      await conn.query(`INSERT INTO faturamento_itens (${cols.join(', ')}) VALUES ?`, [valores]);
    }

    if (divergenciasAuto.length) {
      await conn.query(
        `INSERT INTO faturamento_divergencias (processo_id, chave_item, origem, tipo, descricao, criado_por_id, criado_por_nome) VALUES ?`,
        [divergenciasAuto.map((d) => [p.id, d.chave_item, 'automatica', d.tipo, d.descricao, usuario.id ?? null, 'Sistema (apuração)'])]
      );
    }
    // Itens com divergência (automática ou manual ainda aberta) começam como "divergente"
    await conn.query(
      `UPDATE faturamento_itens i
          SET i.status = 'divergente'
        WHERE i.processo_id = ?
          AND EXISTS (SELECT 1 FROM faturamento_divergencias d
                       WHERE d.processo_id = i.processo_id AND d.chave_item = i.chave_item AND d.status = 'aberta')`,
      [p.id]
    );

    await conn.query(
      `UPDATE faturamento_processos
          SET status = 'apurado', versao_apuracao = ?, motivo_status = NULL,
              apurado_por_id = ?, apurado_por_nome = ?, apurado_em = NOW()
        WHERE id = ?`,
      [versao, usuario.id ?? null, usuario.nome ?? null, p.id]
    );
    await auditar(conn, p.id, usuario, 'apuracao', {
      anterior: { status: p.status, versao: Number(p.versao_apuracao) },
      novo: { status: 'apurado', versao, itens: linhas.length, divergencias_automaticas: divergenciasAuto.length },
    });
    return { ok: true, versao, itens: linhas.length, divergencias: divergenciasAuto.length, avisos: planilha.avisos };
  });
}

// ── Conferência ──────────────────────────────────────────────────────────────
export async function conferirItens(id, { itemIds } = {}, usuario) {
  await inicializarTabelasFaturamentoProcesso();
  const ids = (Array.isArray(itemIds) ? itemIds : []).map(Number).filter(Boolean);
  if (!ids.length) throw erro(400, 'Selecione ao menos um item para conferir.');
  return emTransacao(async (conn) => {
    const p = await carregarProcesso(conn, id, { bloquear: true });
    exigirStatus(p, ['apurado'], 'conferir itens');
    const [itens] = await conn.query(`SELECT id, chave_item, status FROM faturamento_itens WHERE processo_id = ? AND id IN (?)`, [p.id, ids]);
    if (itens.length !== ids.length) throw erro(404, 'Item não encontrado neste processo.');
    const [abertas] = await conn.query(
      `SELECT DISTINCT chave_item FROM faturamento_divergencias WHERE processo_id = ? AND status = 'aberta' AND chave_item IN (?)`,
      [p.id, itens.map((i) => i.chave_item)]
    );
    const comDivergencia = new Set(abertas.map((a) => a.chave_item));
    const conferiveis = itens.filter((i) => !comDivergencia.has(i.chave_item) && i.status !== 'conferido');
    if (conferiveis.length) {
      await conn.query(
        `UPDATE faturamento_itens SET status = 'conferido', conferido_por_id = ?, conferido_por_nome = ?, conferido_em = NOW()
          WHERE processo_id = ? AND id IN (?)`,
        [usuario.id ?? null, usuario.nome ?? null, p.id, conferiveis.map((i) => i.id)]
      );
      for (const i of conferiveis) await auditar(conn, p.id, usuario, 'conferencia_item', { chaveItem: i.chave_item, anterior: i.status, novo: 'conferido' });
    }
    return {
      ok: true,
      conferidos: conferiveis.length,
      bloqueados_por_divergencia: itens.filter((i) => comDivergencia.has(i.chave_item)).length,
    };
  });
}

export async function registrarAjuste(id, itemId, { campo, valor, motivo } = {}, usuario) {
  await inicializarTabelasFaturamentoProcesso();
  if (!CAMPOS_AJUSTAVEIS.includes(campo)) throw erro(400, 'Campo não pode ser ajustado.');
  const n = typeof valor === 'number' ? valor : Number(String(valor ?? '').replace(',', '.'));
  if (valor === '' || valor === null || valor === undefined || !Number.isFinite(n)) throw erro(400, 'Informe um valor numérico.');
  const mot = texto(motivo, 2000);
  if (!mot) throw erro(400, 'Informe o motivo do ajuste.');
  return emTransacao(async (conn) => {
    const p = await carregarProcesso(conn, id, { bloquear: true });
    exigirStatus(p, ['apurado'], 'ajustar itens');
    const [[item]] = await conn.query(`SELECT * FROM faturamento_itens WHERE id = ? AND processo_id = ?`, [Number(itemId), p.id]);
    if (!item) throw erro(404, 'Item não encontrado neste processo.');
    const [[anterior]] = await conn.query(
      `SELECT valor FROM faturamento_ajustes WHERE processo_id = ? AND chave_item = ? AND campo = ?`,
      [p.id, item.chave_item, campo]
    );
    await conn.query(
      `INSERT INTO faturamento_ajustes (processo_id, chave_item, campo, valor, motivo, criado_por_id, criado_por_nome)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE valor = VALUES(valor), motivo = VALUES(motivo),
         criado_por_id = VALUES(criado_por_id), criado_por_nome = VALUES(criado_por_nome), criado_em = CURRENT_TIMESTAMP`,
      [p.id, item.chave_item, campo, r2(n), mot, usuario.id ?? null, usuario.nome ?? null]
    );
    // Item ajustado precisa ser conferido novamente
    if (item.status === 'conferido') {
      await conn.query(`UPDATE faturamento_itens SET status = 'pendente', conferido_por_id = NULL, conferido_por_nome = NULL, conferido_em = NULL WHERE id = ?`, [item.id]);
    }
    await auditar(conn, p.id, usuario, 'ajuste', {
      chaveItem: item.chave_item, campo,
      anterior: anterior ? r2(anterior.valor) : r2(item[campo]),
      novo: r2(n), motivo: mot,
    });
    return { ok: true };
  });
}

export async function removerAjuste(id, ajusteId, { motivo } = {}, usuario) {
  await inicializarTabelasFaturamentoProcesso();
  return emTransacao(async (conn) => {
    const p = await carregarProcesso(conn, id, { bloquear: true });
    exigirStatus(p, ['apurado'], 'remover ajustes');
    const [[a]] = await conn.query(`SELECT * FROM faturamento_ajustes WHERE id = ? AND processo_id = ?`, [Number(ajusteId), p.id]);
    if (!a) throw erro(404, 'Ajuste não encontrado neste processo.');
    await conn.query(`DELETE FROM faturamento_ajustes WHERE id = ?`, [a.id]);
    await conn.query(
      `UPDATE faturamento_itens SET status = 'pendente', conferido_por_id = NULL, conferido_por_nome = NULL, conferido_em = NULL
        WHERE processo_id = ? AND chave_item = ? AND status = 'conferido'`,
      [p.id, a.chave_item]
    );
    await auditar(conn, p.id, usuario, 'remocao_ajuste', {
      chaveItem: a.chave_item, campo: a.campo, anterior: r2(a.valor), motivo: texto(motivo, 2000),
    });
    return { ok: true };
  });
}

// ── Divergências ─────────────────────────────────────────────────────────────
export async function registrarDivergencia(id, { itemId, descricao } = {}, usuario) {
  await inicializarTabelasFaturamentoProcesso();
  const desc = texto(descricao, 5000);
  if (!desc) throw erro(400, 'Descreva a divergência.');
  return emTransacao(async (conn) => {
    const p = await carregarProcesso(conn, id, { bloquear: true });
    exigirStatus(p, ['apurado'], 'registrar divergências');
    let chave = null;
    if (itemId) {
      const [[item]] = await conn.query(`SELECT id, chave_item FROM faturamento_itens WHERE id = ? AND processo_id = ?`, [Number(itemId), p.id]);
      if (!item) throw erro(404, 'Item não encontrado neste processo.');
      chave = item.chave_item;
      await conn.query(
        `UPDATE faturamento_itens SET status = 'divergente', conferido_por_id = NULL, conferido_por_nome = NULL, conferido_em = NULL WHERE id = ?`,
        [item.id]
      );
    }
    const [res] = await conn.query(
      `INSERT INTO faturamento_divergencias (processo_id, chave_item, origem, tipo, descricao, criado_por_id, criado_por_nome)
       VALUES (?, ?, 'manual', 'manual', ?, ?, ?)`,
      [p.id, chave, desc, usuario.id ?? null, usuario.nome ?? null]
    );
    await auditar(conn, p.id, usuario, 'divergencia_registrada', { chaveItem: chave, novo: desc });
    return { ok: true, id: res.insertId };
  });
}

export async function resolverDivergencia(id, divergenciaId, { status, resolucao } = {}, usuario) {
  await inicializarTabelasFaturamentoProcesso();
  if (!['resolvida', 'descartada'].includes(status)) throw erro(400, 'Informe se a divergência foi resolvida ou descartada.');
  const res = texto(resolucao, 5000);
  if (!res) throw erro(400, 'Descreva a resolução da divergência.');
  return emTransacao(async (conn) => {
    const p = await carregarProcesso(conn, id, { bloquear: true });
    exigirStatus(p, ['apurado'], 'resolver divergências');
    const [[d]] = await conn.query(`SELECT * FROM faturamento_divergencias WHERE id = ? AND processo_id = ?`, [Number(divergenciaId), p.id]);
    if (!d) throw erro(404, 'Divergência não encontrada neste processo.');
    if (d.status !== 'aberta') throw erro(409, 'Esta divergência já foi encerrada.');
    await conn.query(
      `UPDATE faturamento_divergencias SET status = ?, resolucao = ?, resolvido_por_id = ?, resolvido_por_nome = ?, resolvido_em = NOW()
        WHERE id = ?`,
      [status, res, usuario.id ?? null, usuario.nome ?? null, d.id]
    );
    if (d.chave_item) {
      // Sem outras divergências abertas, o item volta para "pendente" e precisa ser conferido
      const [[{ n }]] = await conn.query(
        `SELECT COUNT(*) AS n FROM faturamento_divergencias WHERE processo_id = ? AND chave_item = ? AND status = 'aberta'`,
        [p.id, d.chave_item]
      );
      if (Number(n) === 0) {
        await conn.query(
          `UPDATE faturamento_itens SET status = 'pendente' WHERE processo_id = ? AND chave_item = ? AND status = 'divergente'`,
          [p.id, d.chave_item]
        );
      }
    }
    await auditar(conn, p.id, usuario, `divergencia_${status}`, { chaveItem: d.chave_item, anterior: d.descricao, novo: res });
    return { ok: true };
  });
}

// ── Aprovação / rejeição / cancelamento ─────────────────────────────────────
export async function aprovarProcesso(id, usuario) {
  await inicializarTabelasFaturamentoProcesso();
  return emTransacao(async (conn) => {
    const p = await carregarProcesso(conn, id, { bloquear: true });
    const [itens] = await conn.query(`SELECT id, status FROM faturamento_itens WHERE processo_id = ?`, [p.id]);
    const [[{ n }]] = await conn.query(
      `SELECT COUNT(*) AS n FROM faturamento_divergencias WHERE processo_id = ? AND status = 'aberta'`,
      [p.id]
    );
    const imp = impedimentosAprovacao(p, itens, Number(n));
    if (imp.length) throw erro(409, `Não é possível aprovar: ${imp.join(' ')}`);
    await conn.query(
      `UPDATE faturamento_processos SET status = 'aprovado', motivo_status = NULL, aprovado_por_id = ?, aprovado_por_nome = ?, aprovado_em = NOW()
        WHERE id = ?`,
      [usuario.id ?? null, usuario.nome ?? null, p.id]
    );
    await auditar(conn, p.id, usuario, 'aprovacao', { anterior: p.status, novo: 'aprovado' });
    return { ok: true };
  });
}

export async function rejeitarProcesso(id, { motivo } = {}, usuario) {
  await inicializarTabelasFaturamentoProcesso();
  const mot = texto(motivo, 5000);
  if (!mot) throw erro(400, 'Informe o motivo da rejeição.');
  return emTransacao(async (conn) => {
    const p = await carregarProcesso(conn, id, { bloquear: true });
    exigirStatus(p, ['apurado'], 'rejeitar');
    await conn.query(`UPDATE faturamento_processos SET status = 'rejeitado', motivo_status = ? WHERE id = ?`, [mot, p.id]);
    await auditar(conn, p.id, usuario, 'rejeicao', { anterior: p.status, novo: 'rejeitado', motivo: mot });
    return { ok: true };
  });
}

export async function cancelarProcesso(id, { motivo } = {}, usuario) {
  await inicializarTabelasFaturamentoProcesso();
  const mot = texto(motivo, 5000);
  if (!mot) throw erro(400, 'Informe o motivo do cancelamento.');
  return emTransacao(async (conn) => {
    const p = await carregarProcesso(conn, id, { bloquear: true });
    exigirStatus(p, ['aberto', 'apurado', 'rejeitado'], 'cancelar');
    // chave_ativa = NULL libera a criação de um novo processo para o mesmo escopo
    await conn.query(`UPDATE faturamento_processos SET status = 'cancelado', chave_ativa = NULL, motivo_status = ? WHERE id = ?`, [mot, p.id]);
    await auditar(conn, p.id, usuario, 'cancelamento', { anterior: p.status, novo: 'cancelado', motivo: mot });
    return { ok: true };
  });
}

export async function listarAuditoriaProcesso(id) {
  await inicializarTabelasFaturamentoProcesso();
  const [rows] = await pool.query(
    `SELECT * FROM faturamento_auditoria WHERE processo_id = ? ORDER BY criado_em DESC, id DESC LIMIT 1000`,
    [Number(id)]
  );
  return rows;
}
