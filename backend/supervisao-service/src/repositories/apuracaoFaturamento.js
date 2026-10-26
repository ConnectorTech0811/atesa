// ── Apuração por alocação (base da planilha e do processo de faturamento) ───
// Módulo puro: recebe as alocações, batidas, escalas e complementos já carregados
// e devolve, por alocação, horas trabalhadas, previstas, extra, falta e noturno,
// com as inconsistências que impedem conferir o item.
import {
  REGRAS_PADRAO, montarJornadas, apurarJornada, casarComEscala, turnoDoMinuto, paraMinutos,
} from './apuracaoJornadas.js';

const iso = (d) => (d ? String(d).slice(0, 10) : null);
const fmtDataBR = (d) => String(d).split('-').reverse().join('/');

/** Tipos que bloqueiam a conferência (viram divergência no processo). Os demais são avisos. */
export const TIPOS_INCONSISTENCIA = {
  jornada_sem_saida: 'Entrada sem saída',
  saida_sem_entrada: 'Saída sem entrada',
  intervalo_sem_fim: 'Intervalo sem retorno',
  plantao_sem_apontamento: 'Plantão da escala sem apontamento',
  sem_alocacao: 'Batida sem alocação identificável',
  possivel_extra_duplicado: 'Extra automática e complemento no mesmo dia',
};

function alocacaoAtivaEm(a, data) {
  return (!a.data_inicio || iso(a.data_inicio) <= data) && (!a.data_fim || iso(a.data_fim) >= data);
}

/**
 * Descobre a alocação de uma jornada/plantão sem alocacao_id:
 * alocação ativa na data (com a mesma vaga, se houver) e, se só existir uma, ela.
 */
export function resolverAlocacao(item, alocacoesDoCand, data) {
  if (item.alocacao_id) return Number(item.alocacao_id);
  const todas = alocacoesDoCand || [];
  const ativas = todas.filter((a) => alocacaoAtivaEm(a, data));
  const base = ativas.length ? ativas : todas;
  if (item.vaga_id) {
    const v = base.filter((a) => Number(a.vaga_id) === Number(item.vaga_id));
    if (v.length === 1) return v[0].id;
  }
  if (item.empresa_id) {
    const e = base.filter((a) => Number(a.empresa_id) === Number(item.empresa_id));
    if (e.length === 1) return e[0].id;
  }
  return base.length === 1 ? base[0].id : null;
}

function novoResumo() {
  return {
    minutos_apontados: 0, minutos_trabalhados: 0, minutos_previstos: 0, minutos_escala: 0,
    minutos_extra: 0, minutos_falta: 0, minutos_noturnos: 0, minutos_ad_noturno: 0,
    minutos_extra_manual: 0, minutos_ad_noturno_manual: 0, bonificacao_sistema: 0,
    dias: new Set(), pl_diurno: 0, pl_noturno: 0, jornadas: 0,
    inconsistencias: [], avisos: [],
  };
}

/**
 * @param {object} p
 * @param {object[]} p.alocacoes        alocações do cliente (com parâmetros da vaga)
 * @param {object[]} p.todasAlocacoes   todas as alocações dos mesmos cooperados (qualquer cliente)
 * @param {object[]} p.apontamentos     batidas com margem de 1 dia antes/depois do período
 * @param {object[]} p.escalas          plantões dos cooperados no período (qualquer cliente)
 * @param {object[]} p.complementos     complementos da Supervisão no período
 * @param {{inicio:string, fim:string}} p.periodo
 * @param {string} p.hoje               data local (plantões futuros não viram falta)
 * @param {number} p.empresaId
 */
export function apurarAlocacoes({ alocacoes, todasAlocacoes, apontamentos, escalas, complementos, periodo, hoje, empresaId, regras = REGRAS_PADRAO }) {
  const reg = { ...REGRAS_PADRAO, ...regras };
  const doCliente = new Map(alocacoes.map((a) => [Number(a.id), a]));
  const porCand = new Map();
  for (const a of todasAlocacoes) {
    if (!porCand.has(a.candidato_id)) porCand.set(a.candidato_id, []);
    porCand.get(a.candidato_id).push(a);
  }
  const resumos = new Map(alocacoes.map((a) => [Number(a.id), novoResumo()]));
  const noPeriodo = (d) => d >= periodo.inicio && d <= periodo.fim;
  const primeiraDoCand = new Map();
  for (const a of alocacoes) if (!primeiraDoCand.has(a.candidato_id)) primeiraDoCand.set(a.candidato_id, Number(a.id));
  const destinoInconsistencia = (candidatoId, alocId) => resumos.get(alocId) ?? resumos.get(primeiraDoCand.get(candidatoId));

  // Escalas deste cliente, por alocação
  const escalasPorAloc = new Map();
  for (const e of escalas) {
    if (e.status === 'cancelada' || !noPeriodo(iso(e.data))) continue;
    const alocId = resolverAlocacao({ ...e, empresa_id: e.empresa_id_efetiva ?? e.empresa_id }, porCand.get(e.candidato_id), iso(e.data));
    if (alocId === null) {
      if (Number(e.empresa_id_efetiva ?? e.empresa_id) === Number(empresaId)) {
        destinoInconsistencia(e.candidato_id, null)?.inconsistencias.push({
          tipo: 'sem_alocacao', data: iso(e.data), descricao: `Plantão de ${fmtDataBR(iso(e.data))} sem alocação identificável neste cliente.`,
        });
      }
      continue;
    }
    if (!doCliente.has(alocId)) continue;
    if (!escalasPorAloc.has(alocId)) escalasPorAloc.set(alocId, []);
    escalasPorAloc.get(alocId).push(e);
  }

  // Jornadas por cooperado (todas as batidas dele, para casar entrada/saída de qualquer dia)
  const batidasPorCand = new Map();
  for (const b of apontamentos) {
    if (!batidasPorCand.has(b.candidato_id)) batidasPorCand.set(b.candidato_id, []);
    batidasPorCand.get(b.candidato_id).push(b);
  }
  const jornadasPorAloc = new Map();
  for (const [candId, batidas] of batidasPorCand) {
    const { jornadas, inconsistencias } = montarJornadas(batidas, reg);
    for (const inc of inconsistencias) {
      if (!noPeriodo(inc.data)) continue;
      const alocId = resolverAlocacao(inc, porCand.get(candId), inc.data);
      if (alocId !== null && !doCliente.has(alocId)) continue; // é de outro cliente
      destinoInconsistencia(candId, alocId)?.inconsistencias.push({ tipo: inc.tipo, data: inc.data, descricao: inc.descricao });
    }
    for (const j of jornadas) {
      if (!noPeriodo(j.data)) continue;
      const alocId = resolverAlocacao(j, porCand.get(candId), j.data);
      if (alocId === null) {
        destinoInconsistencia(candId, null)?.inconsistencias.push({
          tipo: 'sem_alocacao', data: j.data,
          descricao: `Jornada de ${fmtDataBR(j.data)} sem alocação identificável (cooperado em mais de um posto); não foi faturada.`,
        });
        continue;
      }
      if (!doCliente.has(alocId)) continue;
      if (!jornadasPorAloc.has(alocId)) jornadasPorAloc.set(alocId, []);
      jornadasPorAloc.get(alocId).push(j);
    }
  }

  const diasComExtraAuto = new Map(); // alocação → datas com extra apurada automaticamente
  for (const [alocId, a] of doCliente) {
    const r = resumos.get(alocId);
    const vaga = a.vaga_params ?? null;
    const escs = escalasPorAloc.get(alocId) || [];
    const jors = jornadasPorAloc.get(alocId) || [];
    r.minutos_escala = escs.reduce((s, e) => s + (Number(e.duracao_minutos) || 0), 0);
    const { casadas, semJornada } = casarComEscala(jors, escs, reg);
    const extraAuto = new Set();
    diasComExtraAuto.set(alocId, extraAuto);

    for (const j of jors) {
      const esc = casadas.get(j) ?? null;
      const ap = apurarJornada(j, vaga, esc, reg);
      r.jornadas++;
      r.minutos_apontados += ap.trabalhado;
      r.minutos_trabalhados += ap.trabalhado;
      if (ap.previsto !== null) r.minutos_previstos += ap.previsto;
      r.minutos_extra += ap.extra;
      r.minutos_falta += ap.falta;
      r.minutos_noturnos += ap.noturno;
      r.minutos_ad_noturno += ap.ad_noturno;
      r.dias.add(j.data);
      if (turnoDoMinuto(j.inicio) === 'diurno') r.pl_diurno++; else r.pl_noturno++;
      if (ap.extra > 0) extraAuto.add(j.data);
      for (const av of ap.avisos) r.avisos.push({ ...av, data: j.data });
      if (!esc && escs.length) {
        r.avisos.push({ tipo: 'jornada_fora_da_escala', data: j.data, descricao: `Jornada de ${fmtDataBR(j.data)} não corresponde a nenhum plantão da escala.` });
      }
    }

    // Plantões da escala sem batida: realizada = confirmado pela Supervisão; prevista e já passada = falta
    for (const e of semJornada) {
      const data = iso(e.data);
      if (data >= hoje) continue;
      const desconto = vaga && Number(vaga.desconta_refeicao) ? Number(vaga.tempo_refeicao) || 0 : 0;
      const liquido = Math.max(0, (Number(e.duracao_minutos) || 0) - desconto);
      r.minutos_previstos += liquido;
      if (e.status === 'realizada') {
        r.minutos_trabalhados += liquido;
        r.dias.add(data);
        const ini = paraMinutos(`${data} ${String(e.hora_inicio).slice(0, 5)}`);
        if (turnoDoMinuto(ini) === 'diurno') r.pl_diurno++; else r.pl_noturno++;
        r.avisos.push({ tipo: 'realizada_sem_apontamento', data, descricao: `Plantão de ${fmtDataBR(data)} marcado como realizado na escala, sem batida no App.` });
      } else {
        if (reg.extras_automaticos) r.minutos_falta += liquido;
        r.inconsistencias.push({
          tipo: 'plantao_sem_apontamento', data,
          descricao: `Plantão de ${fmtDataBR(data)} (${String(e.hora_inicio).slice(0, 5)}) previsto na escala sem apontamento no App.`,
        });
      }
    }
  }

  // Complementos lançados pela Supervisão (somados ao que foi apurado)
  for (const c of complementos) {
    const data = iso(c.data_referencia);
    const alocResolvida = resolverAlocacao(c, porCand.get(c.candidato_id), data);
    // Sem alocação no complemento e sem como identificar: vai para a 1ª linha do cooperado neste cliente
    const alocId = alocResolvida ?? (c.alocacao_id ? null : primeiraDoCand.get(c.candidato_id) ?? null);
    if (alocId === null || !doCliente.has(alocId)) continue;
    const r = resumos.get(alocId);
    const mins = Number(c.quantidade_minutos) || Math.round((Number(c.quantidade_horas) || 0) * 60);
    if (c.tipo === 'hora_adicional' || c.tipo === 'hora_extra') {
      r.minutos_extra_manual += mins;
      if (diasComExtraAuto.get(alocId)?.has(data)) {
        r.inconsistencias.push({
          tipo: 'possivel_extra_duplicado', data,
          descricao: `Em ${fmtDataBR(data)} há hora extra apurada automaticamente e também lançada como complemento; confira para não pagar em dobro.`,
        });
      }
    }
    if (c.tipo === 'desconto') r.minutos_extra_manual -= mins;
    if (c.tipo === 'adicional_noturno') r.minutos_ad_noturno_manual += mins;
    if (c.tipo === 'bonificacao') r.bonificacao_sistema += Number(c.valor) || 0;
  }

  return resumos;
}
