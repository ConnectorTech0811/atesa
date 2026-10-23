// ── Comissões de consultores e executivos ───────────────────────────────────
// Cadastros reutilizados: usuarios (perfis consultor / executivo_contas / eh_executivo),
// empresas.executivo_id e empresas.consultor_nome (texto, casado pelo nome do usuário).
//
// Nenhuma base de cálculo é assumida: a regra nasce com base e referência de vigência
// "não definidas" e só gera valor depois de CONFIRMADA (registrando a referência da
// confirmação da ATESA). Regra de pagamento da comissão não é implementada.
import { pool } from '../config/database.js';
import {
  r2, erro, texto, numero, dataISO, emTransacao, garantirEstruturaFinanceira, auditarFin,
} from './financeiroComum.js';

export const PAPEIS = ['consultor', 'executivo'];
export const BASES_CALCULO = {
  nao_definida: 'Não definida (não calcula)',
  valor_nf_servicos: 'Valor dos serviços das notas fiscais emitidas do processo',
  valor_recebido: 'Valor recebido (baixado) nas cobranças do processo',
  manual: 'Base informada manualmente na conferência, com motivo',
};
export const REFERENCIAS_VIGENCIA = {
  nao_definida: 'Não definida (não calcula)',
  competencia: '1º dia da competência do processo',
  emissao_nf: 'Data de emissão da primeira nota fiscal emitida do processo',
};
const CAMPOS_FINANCEIROS_REGRA = ['papel', 'usuario_id', 'empresa_id', 'percentual', 'base_calculo', 'referencia_vigencia', 'vigencia_inicio'];

// ── Regras puras (testáveis sem banco) ──────────────────────────────────────
export function vigenciasSobrepostas(a, b) {
  const fimA = a.vigencia_fim || '9999-12-31';
  const fimB = b.vigencia_fim || '9999-12-31';
  return a.vigencia_inicio <= fimB && b.vigencia_inicio <= fimA;
}

/** Data de referência da vigência conforme a regra (null = ainda não é possível saber). */
export function dataReferencia(regra, contexto) {
  if (regra.referencia_vigencia === 'emissao_nf') return contexto.primeiraEmissaoNf || null;
  return contexto.periodoInicio; // competência (ou regra ainda não definida: só para localizar a regra)
}

/**
 * Escolhe a regra aplicável ao responsável: a mais específica (usuário + cliente > usuário > cliente > geral)
 * entre as ativas do papel com vigência na data de referência.
 */
export function selecionarRegra(regras, { papel, usuarioId, empresaId }, contexto) {
  const candidatas = regras.filter((r) =>
    Number(r.ativa) === 1 && r.papel === papel &&
    (r.usuario_id == null || Number(r.usuario_id) === Number(usuarioId)) &&
    (r.empresa_id == null || Number(r.empresa_id) === Number(empresaId)));
  const semData = candidatas.filter((r) => dataReferencia(r, contexto) === null);
  const vigentes = candidatas.filter((r) => {
    const d = dataReferencia(r, contexto);
    return d !== null && r.vigencia_inicio <= d && (!r.vigencia_fim || r.vigencia_fim >= d);
  });
  if (!vigentes.length) {
    if (semData.length) return { situacao: 'aguardando_base', motivo: 'A regra usa a data de emissão da nota fiscal, mas o processo ainda não tem nota emitida.' };
    return { situacao: 'aguardando_regra', motivo: `Nenhuma regra de comissão ativa e vigente para ${papel === 'consultor' ? 'o consultor' : 'o executivo'}.` };
  }
  const peso = (r) => (r.usuario_id != null ? 2 : 0) + (r.empresa_id != null ? 1 : 0);
  const maior = Math.max(...vigentes.map(peso));
  const melhores = vigentes.filter((r) => peso(r) === maior);
  if (melhores.length > 1) {
    return { situacao: 'aguardando_regra', motivo: `Há ${melhores.length} regras igualmente aplicáveis (ids ${melhores.map((r) => r.id).join(', ')}); ajuste o cadastro.` };
  }
  return { regra: melhores[0] };
}

/** Resultado do cálculo de uma comissão (sem regra confirmada não há valor). */
export function calcularComissao(regra, bases, baseManual) {
  if (!Number(regra.confirmada)) {
    return { situacao: 'aguardando_regra', motivo: `Regra #${regra.id} ainda não confirmada pela ATESA.`, regra };
  }
  if (regra.base_calculo === 'nao_definida' || regra.referencia_vigencia === 'nao_definida') {
    return { situacao: 'aguardando_regra', motivo: `Regra #${regra.id} sem base de cálculo ou referência de vigência definida.`, regra };
  }
  let base = null;
  if (regra.base_calculo === 'valor_nf_servicos') base = bases.valorNfServicos;
  else if (regra.base_calculo === 'valor_recebido') base = bases.valorRecebido;
  else if (regra.base_calculo === 'manual') base = baseManual;
  if (base === null || base === undefined) {
    const motivo = {
      valor_nf_servicos: 'Aguardando nota fiscal emitida para o processo.',
      valor_recebido: 'Aguardando recebimento das cobranças do processo.',
      manual: 'Informe a base de cálculo manual (com motivo).',
    }[regra.base_calculo];
    return { situacao: 'aguardando_base', motivo, regra };
  }
  const pct = Number(regra.percentual);
  return { situacao: 'calculada', regra, percentual: pct, base: r2(base), valor: r2((Number(base) * pct) / 100) };
}

// ── Usuários comissionáveis ─────────────────────────────────────────────────
export async function listarUsuariosComissionaveis() {
  const [rows] = await pool.query(
    `SELECT id, nome, tipo_usuario, eh_executivo FROM usuarios
      WHERE ativo = 1 AND (tipo_usuario IN ('consultor', 'executivo_contas') OR eh_executivo = 1)
      ORDER BY nome`
  );
  return rows;
}

// ── Regras de comissão ──────────────────────────────────────────────────────
export async function listarRegras({ papel, usuarioId, empresaId, incluirInativas } = {}) {
  await garantirEstruturaFinanceira();
  let sql = `SELECT r.*, u.nome AS usuario_nome, e.nome_empresa
               FROM comissao_regras r
               LEFT JOIN usuarios u ON u.id = r.usuario_id
               LEFT JOIN empresas e ON e.id = r.empresa_id
              WHERE 1=1`;
  const params = [];
  if (!incluirInativas || incluirInativas === 'false') sql += ' AND r.ativa = 1';
  if (papel) { sql += ' AND r.papel = ?'; params.push(papel); }
  if (usuarioId) { sql += ' AND r.usuario_id = ?'; params.push(Number(usuarioId)); }
  if (empresaId) { sql += ' AND r.empresa_id = ?'; params.push(Number(empresaId)); }
  sql += ' ORDER BY r.papel, u.nome IS NULL, u.nome, e.nome_empresa IS NULL, e.nome_empresa, r.vigencia_inicio DESC';
  const [rows] = await pool.query(sql, params);
  return rows;
}

function montarRegra(dados) {
  const papel = dados.papel;
  if (!PAPEIS.includes(papel)) throw erro(400, 'Informe o papel: consultor ou executivo.');
  const percentual = numero(dados.percentual);
  if (percentual === null || Number.isNaN(percentual) || percentual <= 0 || percentual > 100) {
    throw erro(400, 'Percentual inválido (maior que 0 e até 100).');
  }
  const inicio = dataISO(dados.vigenciaInicio);
  if (!inicio) throw erro(400, 'Informe o início da vigência.');
  const fim = dados.vigenciaFim ? dataISO(dados.vigenciaFim) : null;
  if (dados.vigenciaFim && !fim) throw erro(400, 'Fim da vigência inválido.');
  if (fim && fim < inicio) throw erro(400, 'O fim da vigência é anterior ao início.');
  const base = dados.baseCalculo || 'nao_definida';
  if (!(base in BASES_CALCULO)) throw erro(400, 'Base de cálculo inválida.');
  const ref = dados.referenciaVigencia || 'nao_definida';
  if (!(ref in REFERENCIAS_VIGENCIA)) throw erro(400, 'Referência de vigência inválida.');
  return {
    papel,
    usuario_id: dados.usuarioId ? Number(dados.usuarioId) : null,
    empresa_id: dados.empresaId ? Number(dados.empresaId) : null,
    percentual: Math.round(percentual * 10000) / 10000,
    base_calculo: base,
    referencia_vigencia: ref,
    vigencia_inicio: inicio,
    vigencia_fim: fim,
    observacao: texto(dados.observacao, 5000),
  };
}

async function validarEscopoRegra(conn, r, ignorarId = null) {
  if (r.usuario_id) {
    const [[u]] = await conn.query(`SELECT id, tipo_usuario, eh_executivo FROM usuarios WHERE id = ?`, [r.usuario_id]);
    if (!u) throw erro(400, 'Usuário não encontrado.');
  }
  if (r.empresa_id) {
    const [[e]] = await conn.query(`SELECT id FROM empresas WHERE id = ?`, [r.empresa_id]);
    if (!e) throw erro(400, 'Cliente não encontrado.');
  }
  const [mesmas] = await conn.query(
    `SELECT id, vigencia_inicio, vigencia_fim FROM comissao_regras
      WHERE ativa = 1 AND papel = ? AND usuario_id <=> ? AND empresa_id <=> ? AND id <> ?`,
    [r.papel, r.usuario_id, r.empresa_id, ignorarId ?? 0]
  );
  const conflito = mesmas.find((m) => vigenciasSobrepostas(m, r));
  if (conflito) throw erro(409, `Já existe a regra #${conflito.id} para o mesmo papel, usuário e cliente com vigência sobreposta.`);
}

export async function criarRegra(dados, usuario) {
  await garantirEstruturaFinanceira();
  const r = montarRegra(dados);
  return emTransacao(async (conn) => {
    await validarEscopoRegra(conn, r);
    const [res] = await conn.query(
      `INSERT INTO comissao_regras (papel, usuario_id, empresa_id, percentual, base_calculo, referencia_vigencia, vigencia_inicio, vigencia_fim, observacao, criado_por_id, criado_por_nome)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [r.papel, r.usuario_id, r.empresa_id, r.percentual, r.base_calculo, r.referencia_vigencia, r.vigencia_inicio, r.vigencia_fim,
        r.observacao, usuario.id ?? null, usuario.nome ?? null]
    );
    await auditarFin(conn, usuario, { entidade: 'comissao_regra', entidadeId: res.insertId, acao: 'criacao', novo: r });
    return { ok: true, id: res.insertId };
  });
}

export async function atualizarRegra(id, dados, usuario) {
  await garantirEstruturaFinanceira();
  return emTransacao(async (conn) => {
    const [[atual]] = await conn.query(`SELECT * FROM comissao_regras WHERE id = ? FOR UPDATE`, [Number(id)]);
    if (!atual) throw erro(404, 'Regra não encontrada.');
    if (!Number(atual.ativa)) throw erro(409, 'Regra inativa não pode ser alterada.');
    const novo = montarRegra({
      papel: atual.papel, usuarioId: atual.usuario_id, empresaId: atual.empresa_id, percentual: atual.percentual,
      baseCalculo: atual.base_calculo, referenciaVigencia: atual.referencia_vigencia, vigenciaInicio: atual.vigencia_inicio,
      vigenciaFim: atual.vigencia_fim, observacao: atual.observacao, ...dados,
    });
    const alterados = Object.keys(novo).filter((c) => String(atual[c] ?? '') !== String(novo[c] ?? '')
      && !(c === 'percentual' && Number(atual[c]) === Number(novo[c])));
    if (!alterados.length) return { ok: true, id: atual.id };
    // Regra confirmada: só observação e encerramento da vigência; mudanças financeiras exigem nova regra
    if (Number(atual.confirmada) && alterados.some((c) => CAMPOS_FINANCEIROS_REGRA.includes(c))) {
      throw erro(409, 'Regra já confirmada: para mudar percentual, base, escopo ou início, encerre a vigência e cadastre uma nova regra.');
    }
    await validarEscopoRegra(conn, novo, atual.id);
    await conn.query(
      `UPDATE comissao_regras SET ${alterados.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`,
      [...alterados.map((c) => novo[c]), atual.id]
    );
    for (const c of alterados) {
      await auditarFin(conn, usuario, { entidade: 'comissao_regra', entidadeId: atual.id, acao: 'edicao', campo: c, anterior: atual[c], novo: novo[c] });
    }
    return { ok: true, id: atual.id };
  });
}

export async function confirmarRegra(id, { confirmacaoReferencia } = {}, usuario) {
  await garantirEstruturaFinanceira();
  const ref = texto(confirmacaoReferencia, 300);
  if (!ref) throw erro(400, 'Informe a referência da confirmação da ATESA (ex.: e-mail, ata ou contrato e data).');
  return emTransacao(async (conn) => {
    const [[r]] = await conn.query(`SELECT * FROM comissao_regras WHERE id = ? FOR UPDATE`, [Number(id)]);
    if (!r) throw erro(404, 'Regra não encontrada.');
    if (!Number(r.ativa)) throw erro(409, 'Regra inativa.');
    if (Number(r.confirmada)) throw erro(409, 'Regra já confirmada.');
    if (r.base_calculo === 'nao_definida' || r.referencia_vigencia === 'nao_definida') {
      throw erro(400, 'Defina a base de cálculo e a referência de vigência antes de confirmar.');
    }
    await conn.query(
      `UPDATE comissao_regras SET confirmada = 1, confirmacao_referencia = ?, confirmada_por_id = ?, confirmada_por_nome = ?, confirmada_em = NOW() WHERE id = ?`,
      [ref, usuario.id ?? null, usuario.nome ?? null, r.id]
    );
    await auditarFin(conn, usuario, { entidade: 'comissao_regra', entidadeId: r.id, acao: 'confirmacao', novo: ref });
    return { ok: true };
  });
}

export async function inativarRegra(id, { motivo } = {}, usuario) {
  await garantirEstruturaFinanceira();
  const mot = texto(motivo, 2000);
  if (!mot) throw erro(400, 'Informe o motivo da inativação.');
  return emTransacao(async (conn) => {
    const [[r]] = await conn.query(`SELECT id, ativa FROM comissao_regras WHERE id = ? FOR UPDATE`, [Number(id)]);
    if (!r) throw erro(404, 'Regra não encontrada.');
    if (!Number(r.ativa)) throw erro(409, 'Regra já inativa.');
    await conn.query(`UPDATE comissao_regras SET ativa = 0 WHERE id = ?`, [r.id]);
    await auditarFin(conn, usuario, { entidade: 'comissao_regra', entidadeId: r.id, acao: 'inativacao', motivo: mot });
    return { ok: true };
  });
}

// ── Responsáveis do processo ────────────────────────────────────────────────
async function carregarProcesso(conn, processoId) {
  const [[p]] = await conn.query(`SELECT * FROM faturamento_processos WHERE id = ?`, [Number(processoId)]);
  if (!p) throw erro(404, 'Processo de faturamento não encontrado.');
  return p;
}

/** Responsáveis sugeridos pelo cadastro da empresa (executivo por id; consultor pelo nome). */
export async function sugerirResponsaveis(processoId) {
  await garantirEstruturaFinanceira();
  const p = await carregarProcesso(pool, processoId);
  const [[e]] = await pool.query(`SELECT id, executivo_id, executivo_nome, consultor_nome FROM empresas WHERE id = ?`, [p.empresa_id]);
  const sugestoes = [];
  const avisos = [];
  if (e?.executivo_id) {
    const [[u]] = await pool.query(`SELECT id, nome FROM usuarios WHERE id = ?`, [e.executivo_id]);
    if (u) sugestoes.push({ papel: 'executivo', usuario_id: u.id, usuario_nome: u.nome });
    else avisos.push(`Executivo do cadastro da empresa (id ${e.executivo_id}, ${e.executivo_nome || 'sem nome'}) não encontrado em usuários.`);
  } else avisos.push('A empresa não tem executivo de contas vinculado no cadastro.');
  const nomeConsultor = String(e?.consultor_nome || '').trim();
  if (nomeConsultor) {
    const [us] = await pool.query(`SELECT id, nome FROM usuarios WHERE TRIM(nome) = ? AND tipo_usuario = 'consultor'`, [nomeConsultor]);
    if (us.length === 1) sugestoes.push({ papel: 'consultor', usuario_id: us[0].id, usuario_nome: us[0].nome });
    else avisos.push(`Consultor "${nomeConsultor}" do cadastro da empresa não corresponde a um usuário com perfil Consultor; vincule manualmente.`);
  } else avisos.push('A empresa não tem consultor informado no cadastro.');
  return { sugestoes, avisos };
}

export async function listarResponsaveis(processoId) {
  await garantirEstruturaFinanceira();
  const [rows] = await pool.query(`SELECT * FROM faturamento_responsaveis WHERE processo_id = ? ORDER BY papel, usuario_nome`, [Number(processoId)]);
  return rows;
}

async function inserirResponsavel(conn, processo, { papel, usuarioId, origem }, usuario) {
  if (!PAPEIS.includes(papel)) throw erro(400, 'Informe o papel: consultor ou executivo.');
  const [[u]] = await conn.query(`SELECT id, nome FROM usuarios WHERE id = ? AND ativo = 1`, [Number(usuarioId)]);
  if (!u) throw erro(400, 'Usuário não encontrado ou inativo.');
  const [res] = await conn.query(
    `INSERT IGNORE INTO faturamento_responsaveis (processo_id, papel, usuario_id, usuario_nome, origem, criado_por_id, criado_por_nome)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [processo.id, papel, u.id, u.nome, origem, usuario.id ?? null, usuario.nome ?? null]
  );
  if (res.affectedRows) {
    await auditarFin(conn, usuario, { entidade: 'responsavel', entidadeId: res.insertId, processoId: processo.id, acao: 'vinculo', novo: { papel, usuario: u.nome, origem } });
  }
  return res.affectedRows > 0;
}

export async function vincularResponsaveisDaEmpresa(processoId, usuario) {
  const { sugestoes, avisos } = await sugerirResponsaveis(processoId);
  return emTransacao(async (conn) => {
    const p = await carregarProcesso(conn, processoId);
    if (p.status === 'cancelado') throw erro(409, 'Processo cancelado.');
    let incluidos = 0;
    for (const s of sugestoes) if (await inserirResponsavel(conn, p, { papel: s.papel, usuarioId: s.usuario_id, origem: 'empresa' }, usuario)) incluidos++;
    return { ok: true, incluidos, avisos };
  });
}

export async function adicionarResponsavel(processoId, { papel, usuarioId } = {}, usuario) {
  await garantirEstruturaFinanceira();
  return emTransacao(async (conn) => {
    const p = await carregarProcesso(conn, processoId);
    if (p.status === 'cancelado') throw erro(409, 'Processo cancelado.');
    const ok = await inserirResponsavel(conn, p, { papel, usuarioId, origem: 'manual' }, usuario);
    if (!ok) throw erro(409, 'Este usuário já é responsável neste papel.');
    return { ok: true };
  });
}

export async function removerResponsavel(processoId, responsavelId, { motivo } = {}, usuario) {
  await garantirEstruturaFinanceira();
  const mot = texto(motivo, 2000);
  if (!mot) throw erro(400, 'Informe o motivo da remoção.');
  return emTransacao(async (conn) => {
    const [[r]] = await conn.query(`SELECT * FROM faturamento_responsaveis WHERE id = ? AND processo_id = ?`, [Number(responsavelId), Number(processoId)]);
    if (!r) throw erro(404, 'Responsável não encontrado neste processo.');
    const [[c]] = await conn.query(`SELECT id, situacao FROM comissoes WHERE responsavel_id = ?`, [r.id]);
    if (c?.situacao === 'conferida') throw erro(409, 'A comissão deste responsável já foi conferida; conteste-a antes de remover.');
    if (c) await conn.query(`DELETE FROM comissoes WHERE id = ?`, [c.id]);
    await conn.query(`DELETE FROM faturamento_responsaveis WHERE id = ?`, [r.id]);
    await auditarFin(conn, usuario, { entidade: 'responsavel', entidadeId: r.id, processoId: r.processo_id, acao: 'remocao', anterior: { papel: r.papel, usuario: r.usuario_nome }, motivo: mot });
    return { ok: true };
  });
}

// ── Cálculo e conferência ───────────────────────────────────────────────────
async function basesDoProcesso(conn, processoId) {
  const [[nf]] = await conn.query(
    `SELECT COUNT(*) AS n, SUM(valor_servicos) AS total, MIN(data_emissao) AS primeira
       FROM faturamento_notas WHERE processo_id = ? AND status = 'emitida'`,
    [processoId]
  );
  const [[rec]] = await conn.query(
    `SELECT COUNT(*) AS n, SUM(r.valor) AS total
       FROM financeiro_recebimentos r
       JOIN faturamento_cobrancas c ON c.id = r.cobranca_id
      WHERE c.processo_id = ? AND c.status <> 'cancelada' AND r.situacao = 'ativo'`,
    [processoId]
  );
  return {
    valorNfServicos: Number(nf.n) ? r2(nf.total) : null,
    valorRecebido: Number(rec.n) ? r2(rec.total) : null,
    primeiraEmissaoNf: nf.primeira ? String(nf.primeira).slice(0, 10) : null,
  };
}

export async function calcularComissoesProcesso(processoId, usuario) {
  await garantirEstruturaFinanceira();
  return emTransacao(async (conn) => {
    const p = await carregarProcesso(conn, processoId);
    if (p.status !== 'aprovado') throw erro(409, 'As comissões são calculadas somente para processos com apuração aprovada.');
    const [responsaveis] = await conn.query(`SELECT * FROM faturamento_responsaveis WHERE processo_id = ?`, [p.id]);
    if (!responsaveis.length) throw erro(409, 'Vincule os responsáveis (consultor/executivo) ao processo antes de calcular.');
    const [regras] = await conn.query(`SELECT * FROM comissao_regras WHERE ativa = 1`);
    for (const r of regras) {
      r.vigencia_inicio = String(r.vigencia_inicio).slice(0, 10);
      r.vigencia_fim = r.vigencia_fim ? String(r.vigencia_fim).slice(0, 10) : null;
    }
    const bases = await basesDoProcesso(conn, p.id);
    const contexto = { periodoInicio: String(p.periodo_inicio).slice(0, 10), primeiraEmissaoNf: bases.primeiraEmissaoNf };
    const [existentes] = await conn.query(`SELECT * FROM comissoes WHERE processo_id = ?`, [p.id]);
    const porResp = new Map(existentes.map((c) => [c.responsavel_id, c]));

    const resumo = { calculadas: 0, aguardando: 0, conferidas_mantidas: 0, conferidas_alteradas: 0 };
    for (const resp of responsaveis) {
      const anterior = porResp.get(resp.id);
      const sel = selecionarRegra(regras, { papel: resp.papel, usuarioId: resp.usuario_id, empresaId: p.empresa_id }, contexto);
      const baseManual = anterior?.base_calculo === 'manual' && anterior.base_valor !== null ? Number(anterior.base_valor) : null;
      const res = sel.regra ? calcularComissao(sel.regra, bases, baseManual) : sel;
      const novo = {
        regra_id: res.regra?.id ?? null,
        percentual: res.regra ? Number(res.regra.percentual) : null,
        base_calculo: res.regra?.base_calculo ?? null,
        base_valor: res.situacao === 'calculada' ? res.base : (res.regra?.base_calculo === 'manual' ? baseManual : null),
        valor: res.situacao === 'calculada' ? res.valor : null,
        motivo_situacao: res.motivo ?? null,
      };
      let situacao = res.situacao;
      const igual = anterior && Number(anterior.regra_id) === Number(novo.regra_id) && Number(anterior.percentual) === Number(novo.percentual)
        && (anterior.base_valor === null ? null : r2(anterior.base_valor)) === novo.base_valor
        && (anterior.valor === null ? null : r2(anterior.valor)) === novo.valor;
      if (anterior && ['conferida', 'contestada'].includes(anterior.situacao) && igual) {
        if (anterior.situacao === 'conferida') resumo.conferidas_mantidas++;
        continue;
      }
      if (anterior?.situacao === 'conferida') resumo.conferidas_alteradas++;
      if (situacao === 'calculada') resumo.calculadas++; else resumo.aguardando++;

      if (anterior) {
        await conn.query(
          `UPDATE comissoes SET regra_id = ?, percentual = ?, base_calculo = ?, base_valor = ?, valor = ?, situacao = ?, motivo_situacao = ?,
                  conferido_por_id = NULL, conferido_por_nome = NULL, conferido_em = NULL, calculado_em = NOW()
            WHERE id = ?`,
          [novo.regra_id, novo.percentual, novo.base_calculo, novo.base_valor, novo.valor, situacao, novo.motivo_situacao, anterior.id]
        );
      } else {
        await conn.query(
          `INSERT INTO comissoes (processo_id, responsavel_id, usuario_id, usuario_nome, papel, regra_id, percentual, base_calculo, base_valor, valor, situacao, motivo_situacao, calculado_em)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
          [p.id, resp.id, resp.usuario_id, resp.usuario_nome, resp.papel, novo.regra_id, novo.percentual, novo.base_calculo,
            novo.base_valor, novo.valor, situacao, novo.motivo_situacao]
        );
      }
      await auditarFin(conn, usuario, {
        entidade: 'comissao', entidadeId: anterior?.id ?? null, processoId: p.id, acao: 'calculo',
        campo: resp.usuario_nome,
        anterior: anterior ? { situacao: anterior.situacao, valor: anterior.valor, regra_id: anterior.regra_id } : null,
        novo: { situacao, valor: novo.valor, regra_id: novo.regra_id, base: novo.base_valor },
      });
    }
    return { ok: true, ...resumo };
  });
}

export async function listarComissoes({ processoId, competencia, usuarioId, situacao } = {}) {
  await garantirEstruturaFinanceira();
  let sql = `SELECT c.*, p.codigo AS processo_codigo, p.competencia, e.nome_empresa,
                    r.confirmada AS regra_confirmada, r.confirmacao_referencia
               FROM comissoes c
               JOIN faturamento_processos p ON p.id = c.processo_id
               JOIN empresas e ON e.id = p.empresa_id
               LEFT JOIN comissao_regras r ON r.id = c.regra_id
              WHERE 1=1`;
  const params = [];
  if (processoId) { sql += ' AND c.processo_id = ?'; params.push(Number(processoId)); }
  if (competencia) { sql += ' AND p.competencia = ?'; params.push(competencia); }
  if (usuarioId) { sql += ' AND c.usuario_id = ?'; params.push(Number(usuarioId)); }
  if (situacao) { sql += ' AND c.situacao = ?'; params.push(situacao); }
  sql += ' ORDER BY p.competencia DESC, c.papel, c.usuario_nome LIMIT 1000';
  const [rows] = await pool.query(sql, params);
  return rows;
}

async function carregarComissao(conn, id) {
  const [[c]] = await conn.query(`SELECT * FROM comissoes WHERE id = ? FOR UPDATE`, [Number(id)]);
  if (!c) throw erro(404, 'Comissão não encontrada.');
  return c;
}

export async function informarBaseManual(id, { valor, motivo } = {}, usuario) {
  await garantirEstruturaFinanceira();
  const n = numero(valor);
  if (n === null || Number.isNaN(n) || n < 0) throw erro(400, 'Informe uma base de cálculo válida.');
  const mot = texto(motivo, 2000);
  if (!mot) throw erro(400, 'Informe o motivo / origem da base manual.');
  return emTransacao(async (conn) => {
    const c = await carregarComissao(conn, id);
    if (c.base_calculo !== 'manual') throw erro(409, 'A regra desta comissão não usa base manual.');
    if (c.situacao === 'conferida') throw erro(409, 'Comissão já conferida.');
    const [[regra]] = await conn.query(`SELECT * FROM comissao_regras WHERE id = ?`, [c.regra_id]);
    const res = calcularComissao(regra, {}, r2(n));
    await conn.query(
      `UPDATE comissoes SET base_valor = ?, base_manual_motivo = ?, valor = ?, situacao = ?, motivo_situacao = ?, calculado_em = NOW() WHERE id = ?`,
      [r2(n), mot, res.valor ?? null, res.situacao, res.motivo ?? null, c.id]
    );
    await auditarFin(conn, usuario, { entidade: 'comissao', entidadeId: c.id, processoId: c.processo_id, acao: 'base_manual', anterior: c.base_valor, novo: r2(n), motivo: mot });
    return { ok: true };
  });
}

export async function conferirComissao(id, usuario) {
  await garantirEstruturaFinanceira();
  return emTransacao(async (conn) => {
    const c = await carregarComissao(conn, id);
    if (c.situacao !== 'calculada') throw erro(409, 'Só é possível conferir comissões calculadas (com regra confirmada e base disponível).');
    await conn.query(
      `UPDATE comissoes SET situacao = 'conferida', conferido_por_id = ?, conferido_por_nome = ?, conferido_em = NOW() WHERE id = ?`,
      [usuario.id ?? null, usuario.nome ?? null, c.id]
    );
    await auditarFin(conn, usuario, { entidade: 'comissao', entidadeId: c.id, processoId: c.processo_id, acao: 'conferencia', novo: { valor: c.valor } });
    return { ok: true };
  });
}

export async function contestarComissao(id, { motivo } = {}, usuario) {
  await garantirEstruturaFinanceira();
  const mot = texto(motivo, 2000);
  if (!mot) throw erro(400, 'Informe o motivo da contestação.');
  return emTransacao(async (conn) => {
    const c = await carregarComissao(conn, id);
    if (!['calculada', 'conferida'].includes(c.situacao)) throw erro(409, 'Só é possível contestar comissões calculadas ou conferidas.');
    await conn.query(
      `UPDATE comissoes SET situacao = 'contestada', motivo_situacao = ?, conferido_por_id = NULL, conferido_por_nome = NULL, conferido_em = NULL WHERE id = ?`,
      [mot, c.id]
    );
    await auditarFin(conn, usuario, { entidade: 'comissao', entidadeId: c.id, processoId: c.processo_id, acao: 'contestacao', anterior: c.situacao, novo: 'contestada', motivo: mot });
    return { ok: true };
  });
}

/** Contestada → volta a ser calculada no próximo "Calcular". */
export async function reabrirComissao(id, { motivo } = {}, usuario) {
  await garantirEstruturaFinanceira();
  const mot = texto(motivo, 2000);
  if (!mot) throw erro(400, 'Informe o motivo da reabertura.');
  return emTransacao(async (conn) => {
    const c = await carregarComissao(conn, id);
    if (c.situacao !== 'contestada') throw erro(409, 'Só comissões contestadas podem ser reabertas.');
    await conn.query(`UPDATE comissoes SET situacao = IF(valor IS NULL, 'aguardando_base', 'calculada'), motivo_situacao = NULL WHERE id = ?`, [c.id]);
    await auditarFin(conn, usuario, { entidade: 'comissao', entidadeId: c.id, processoId: c.processo_id, acao: 'reabertura', motivo: mot });
    return { ok: true };
  });
}
