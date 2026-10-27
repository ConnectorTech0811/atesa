// ── Apuração de jornadas a partir das batidas do App do cooperado ───────────
// Módulo puro (sem banco): monta as jornadas pelos pares de batidas e confronta
// com a escala e com os parâmetros da vaga (horário, refeição, pausa, adicional noturno).
//
// Por que pares e não "dia": o App grava em cada batida a data do próprio dia, então
// um plantão 19:00 → 07:00 tem a entrada num dia e a saída no seguinte. A jornada é
// sempre atribuída à data da ENTRADA.

/** Regras de apuração. Os valores marcados como pendentes aguardam confirmação da ATESA. */
export const REGRAS_PADRAO = Object.freeze({
  // Diferença (para mais ou para menos) até este limite não gera extra nem falta. Referência: CLT art. 58 §1º.
  tolerancia_minutos: 10,
  // Janela do adicional noturno (padrão legal urbano 22h–5h)
  noturno_inicio: '22:00',
  noturno_fim: '05:00',
  // Hora noturna reduzida (52min30s) — desligada por padrão
  hora_noturna_reduzida: false,
  // Vaga desconta refeição, mas o cooperado não registrou: 'descontar_parametro' (desconta o tempo da vaga) ou 'nao_descontar'
  refeicao_nao_registrada: 'descontar_parametro',
  // Extra e falta calculados automaticamente (desligue se a Supervisão lançar tudo como complemento)
  extras_automaticos: true,
  // Entrada sem saída por mais tempo que isto é considerada jornada incompleta
  jornada_maxima_horas: 26,
  // Janela para casar a entrada do App com o início do plantão na escala
  janela_escala_horas: 4,
});

const MIN_DIA = 1440;

/** "YYYY-MM-DD HH:MM[:SS]" (horário local, como gravado no banco) → minutos absolutos. */
export function paraMinutos(ts) {
  if (ts instanceof Date) {
    return Math.floor(Date.UTC(ts.getFullYear(), ts.getMonth(), ts.getDate(), ts.getHours(), ts.getMinutes(), ts.getSeconds()) / 60000);
  }
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/.exec(String(ts || ''));
  if (!m) return null;
  return Math.floor(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0)) / 60000);
}

export function dataDeMinutos(min) {
  return new Date(min * 60000).toISOString().slice(0, 10);
}

export function horaParaMin(h) {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(h || '').trim());
  if (!m || +m[1] > 23 || +m[2] > 59) return null;
  return +m[1] * 60 + +m[2];
}

/**
 * Lê o horário parametrizado da vaga (texto livre: "07:00 às 19:00", "19h - 07h"...).
 * Mesma regra da tela de Lançamento de Escalas: HH:MM tem prioridade sobre "12h".
 */
export function lerHorarioVaga(texto) {
  const ler = (re) => [...String(texto || '').matchAll(re)]
    .map((m) => ({ hh: +m[1], mm: +(m[2] || 0) }))
    .filter((h) => h.hh <= 23 && h.mm <= 59);
  let horas = ler(/(\d{1,2})\s*:\s*(\d{2})/g);
  if (horas.length < 2) horas = ler(/(\d{1,2})\s*(?::|h)\s*(\d{2})?/gi);
  if (horas.length < 2) return null;
  const ini = horas[0].hh * 60 + horas[0].mm;
  let fim = horas[1].hh * 60 + horas[1].mm;
  if (fim <= ini) fim += MIN_DIA;
  return { inicio: ini, duracao: fim - ini };
}

/** Minutos de [ini, fim) que caem na janela diária [janIni, janFim) — janela pode virar a noite. */
export function minutosNaJanela(ini, fim, janIni, janFim) {
  if (!(fim > ini)) return 0;
  const vira = janFim <= janIni;
  let total = 0;
  const dia0 = Math.floor(ini / MIN_DIA) - 1;
  const dia1 = Math.floor(fim / MIN_DIA);
  for (let d = dia0; d <= dia1; d++) {
    const a = d * MIN_DIA + janIni;
    const b = d * MIN_DIA + janFim + (vira ? MIN_DIA : 0);
    total += Math.max(0, Math.min(fim, b) - Math.max(ini, a));
  }
  return total;
}

const fmtHora = (min) => {
  const m = ((min % MIN_DIA) + MIN_DIA) % MIN_DIA;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};
const fmtDataBR = (iso) => String(iso).split('-').reverse().join('/');

/**
 * Monta as jornadas de UM cooperado a partir das batidas (qualquer ordem).
 * Entrada → próxima saída; refeição e pausa são pareadas dentro da jornada aberta.
 * @returns {{ jornadas: object[], inconsistencias: object[] }}
 */
export function montarJornadas(apontamentos = [], regras = REGRAS_PADRAO) {
  const maxMin = (Number(regras.jornada_maxima_horas) || REGRAS_PADRAO.jornada_maxima_horas) * 60;
  const bats = apontamentos
    .map((a) => ({ ...a, _min: paraMinutos(a.timestamp_dispositivo) }))
    .filter((a) => a._min !== null)
    .sort((a, b) => a._min - b._min);

  const jornadas = [];
  const inconsistencias = [];
  let aberta = null;

  const incons = (tipo, bat, descricao) => inconsistencias.push({
    tipo,
    candidato_id: bat.candidato_id,
    alocacao_id: bat.alocacao_id ?? null,
    vaga_id: bat.vaga_id ?? null,
    data: dataDeMinutos(bat._min),
    descricao,
  });

  const fecharIncompleta = (motivo) => {
    incons('jornada_sem_saida', aberta.bat, `Entrada em ${fmtDataBR(dataDeMinutos(aberta.inicio))} às ${fmtHora(aberta.inicio)} sem registro de saída${motivo ? ` (${motivo})` : ''}.`);
    aberta = null;
  };

  for (const b of bats) {
    const tipo = b.tipo_evento;
    if (aberta && b._min - aberta.inicio > maxMin) fecharIncompleta(`mais de ${maxMin / 60}h sem saída`);

    if (tipo === 'jornada_inicio') {
      if (aberta) fecharIncompleta('nova entrada registrada antes da saída');
      aberta = { bat: b, inicio: b._min, intervalos: [], refAberta: null, pausaAberta: null };
    } else if (tipo === 'jornada_fim') {
      if (!aberta) {
        incons('saida_sem_entrada', b, `Saída em ${fmtDataBR(dataDeMinutos(b._min))} às ${fmtHora(b._min)} sem entrada correspondente.`);
        continue;
      }
      for (const [k, rotulo] of [['refAberta', 'refeição'], ['pausaAberta', 'pausa']]) {
        if (aberta[k] !== null) incons('intervalo_sem_fim', aberta.bat, `Início de ${rotulo} às ${fmtHora(aberta[k])} sem retorno registrado; não foi descontado.`);
      }
      const ini = aberta.bat;
      jornadas.push({
        candidato_id: ini.candidato_id,
        alocacao_id: ini.alocacao_id ?? b.alocacao_id ?? null,
        vaga_id: ini.vaga_id ?? b.vaga_id ?? null,
        data: dataDeMinutos(aberta.inicio),
        inicio: aberta.inicio,
        fim: b._min,
        minutos_brutos: b._min - aberta.inicio,
        intervalos: aberta.intervalos,
      });
      aberta = null;
    } else if (tipo === 'refeicao_inicio' || tipo === 'pausa_inicio') {
      const k = tipo === 'refeicao_inicio' ? 'refAberta' : 'pausaAberta';
      if (aberta) aberta[k] = b._min;
    } else if (tipo === 'refeicao_fim' || tipo === 'pausa_fim') {
      const k = tipo === 'refeicao_fim' ? 'refAberta' : 'pausaAberta';
      if (aberta && aberta[k] !== null) {
        aberta.intervalos.push({ tipo: tipo === 'refeicao_fim' ? 'refeicao' : 'pausa', inicio: aberta[k], fim: b._min });
        aberta[k] = null;
      }
    }
  }
  if (aberta) fecharIncompleta('');
  return { jornadas, inconsistencias };
}

/** Soma simples (Monitoramento): minutos da jornada menos refeições registradas. */
export function minutosTrabalhadosSimples(apontamentos = []) {
  const porCand = new Map();
  for (const a of apontamentos) {
    const k = a.candidato_id ?? 0;
    if (!porCand.has(k)) porCand.set(k, []);
    porCand.get(k).push(a);
  }
  let total = 0;
  for (const lista of porCand.values()) {
    for (const j of montarJornadas(lista).jornadas) {
      const ref = j.intervalos.filter((i) => i.tipo === 'refeicao').reduce((s, i) => s + (i.fim - i.inicio), 0);
      total += Math.max(0, j.minutos_brutos - ref);
    }
  }
  return total;
}

/**
 * Confronta uma jornada com o previsto (escala do dia ou horário da vaga) e com as regras.
 * @param {object} j        jornada de montarJornadas
 * @param {object|null} vaga parâmetros da vaga (desconta_refeicao, tempo_refeicao, desconta_pausa, tempo_pausa, adicional_noturno, horario)
 * @param {object|null} escala plantão casado (duracao_minutos)
 */
export function apurarJornada(j, vaga, escala, regras = REGRAS_PADRAO) {
  const reg = { ...REGRAS_PADRAO, ...regras };
  const avisos = [];
  const somaIntervalos = (tipo) => j.intervalos.filter((i) => i.tipo === tipo).reduce((s, i) => s + (i.fim - i.inicio), 0);
  const refRegistrada = somaIntervalos('refeicao');
  const pausaRegistrada = somaIntervalos('pausa');
  const tempoRef = Number(vaga?.tempo_refeicao) || 0;
  const tempoPausa = Number(vaga?.tempo_pausa) || 0;

  // Desconto da refeição/pausa: segue a vaga; sem vaga, desconta só a refeição registrada (comportamento anterior)
  let descRef = 0;
  let descPausa = 0;
  let intervalosDescontados = [];
  if (!vaga) {
    descRef = refRegistrada;
    intervalosDescontados = j.intervalos.filter((i) => i.tipo === 'refeicao');
  } else {
    if (Number(vaga.desconta_refeicao)) {
      if (refRegistrada > 0) {
        descRef = refRegistrada;
        intervalosDescontados.push(...j.intervalos.filter((i) => i.tipo === 'refeicao'));
      } else if (tempoRef > 0 && reg.refeicao_nao_registrada === 'descontar_parametro') {
        descRef = tempoRef;
        avisos.push({ tipo: 'refeicao_nao_registrada', descricao: `Refeição não registrada em ${fmtDataBR(j.data)}; descontado o tempo da vaga (${tempoRef} min).` });
      } else if (tempoRef > 0) {
        avisos.push({ tipo: 'refeicao_nao_registrada', descricao: `Refeição não registrada em ${fmtDataBR(j.data)}; nada foi descontado.` });
      }
    }
    if (Number(vaga.desconta_pausa)) {
      descPausa = pausaRegistrada;
      intervalosDescontados.push(...j.intervalos.filter((i) => i.tipo === 'pausa'));
    }
  }
  const trabalhado = Math.max(0, j.minutos_brutos - descRef - descPausa);

  // Previsto: plantão da escala; sem escala, o horário parametrizado na vaga
  const horarioVaga = lerHorarioVaga(vaga?.horario);
  const previstoBruto = escala ? Number(escala.duracao_minutos) || null : horarioVaga?.duracao ?? null;
  const descontoPrevisto = (vaga && Number(vaga.desconta_refeicao) ? tempoRef : 0) + (vaga && Number(vaga.desconta_pausa) ? tempoPausa : 0);
  const previsto = previstoBruto !== null ? Math.max(0, previstoBruto - descontoPrevisto) : null;

  let extra = 0;
  let falta = 0;
  if (previsto !== null && reg.extras_automaticos) {
    const dif = trabalhado - previsto;
    const tol = Number(reg.tolerancia_minutos) || 0;
    if (dif > tol) extra = dif;
    else if (-dif > tol) falta = -dif;
  }

  // Noturno: minutos da jornada na janela noturna, menos intervalos descontados dentro dela
  const janIni = horaParaMin(reg.noturno_inicio) ?? 22 * 60;
  const janFim = horaParaMin(reg.noturno_fim) ?? 5 * 60;
  let noturno = minutosNaJanela(j.inicio, j.fim, janIni, janFim);
  for (const i of intervalosDescontados) noturno -= minutosNaJanela(i.inicio, i.fim, janIni, janFim);
  noturno = Math.max(0, noturno);
  if (reg.hora_noturna_reduzida) noturno = Math.round((noturno * 60) / 52.5);
  const adNoturno = vaga && Number(vaga.adicional_noturno) ? noturno : 0;

  return {
    trabalhado,
    previsto,
    extra,
    falta,
    noturno,
    ad_noturno: adNoturno,
    desconto_refeicao: descRef,
    desconto_pausa: descPausa,
    avisos,
  };
}

/** Plantão diurno se começa entre 07:00 e 18:59 (mesma regra da escala). */
export const turnoDoMinuto = (min) => {
  const h = Math.floor((((min % MIN_DIA) + MIN_DIA) % MIN_DIA) / 60);
  return h >= 7 && h < 19 ? 'diurno' : 'noturno';
};

/**
 * Casa jornadas com os plantões da escala (mesmo cooperado, entrada até N horas do início previsto).
 * @returns Map<jornada, escala> e a lista de plantões sem jornada
 */
export function casarComEscala(jornadas, escalas, regras = REGRAS_PADRAO) {
  const janela = (Number(regras.janela_escala_horas) || REGRAS_PADRAO.janela_escala_horas) * 60;
  const livres = escalas
    .filter((e) => e.status !== 'cancelada')
    .map((e) => ({ e, ini: paraMinutos(`${String(e.data).slice(0, 10)} ${String(e.hora_inicio).slice(0, 5)}`) }))
    .filter((x) => x.ini !== null);
  const casadas = new Map();
  for (const j of [...jornadas].sort((a, b) => a.inicio - b.inicio)) {
    let melhor = -1;
    let melhorDist = Infinity;
    livres.forEach((x, i) => {
      if (Number(x.e.candidato_id) !== Number(j.candidato_id)) return;
      const d = Math.abs(x.ini - j.inicio);
      if (d <= janela && d < melhorDist) { melhor = i; melhorDist = d; }
    });
    if (melhor >= 0) {
      casadas.set(j, livres[melhor].e);
      livres.splice(melhor, 1);
    }
  }
  return { casadas, semJornada: livres.map((x) => x.e) };
}
