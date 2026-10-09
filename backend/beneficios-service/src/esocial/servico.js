import * as repo from '../repositories/esocialRepository.js';
import {
  TIPOS_EVENTO, montarS2300, montarS1200, montarS1210, montarS1299, montarS1298,
  gerarIdEvento, validarConfiguracao, somenteDigitos, competenciaValida, periodoPagamento, normalizarData,
} from './layouts.js';
import { assinarEvento, obterCertificado } from './certificado.js';
import { enviarLote as wsEnviarLote, consultarLote as wsConsultarLote, montarLote, MAX_EVENTOS_POR_LOTE, extrairTotaisApurados } from './webservice.js';

/**
 * Regras do envio ao eSocial.
 *
 * Cada tentativa de envio gera uma linha em esocial_eventos — é assim que se
 * acompanha o histórico de tentativas de cada cooperado. O envio é feito em
 * lotes de no máximo 50 eventos (limite do eSocial); cada chamada envia UM lote
 * e informa quantos cooperados restam, para a tela continuar até o fim.
 */

export class ErroESocial extends Error {
  constructor(mensagem, status = 400) {
    super(mensagem);
    this.status = status;
  }
}

const TIPOS_COOPERADO = ['S-2300', 'S-1200', 'S-1210'];
const STATUS_EM_ANDAMENTO = ['enviando', 'enviado'];

export async function carregarConfigValida(tipo) {
  await repo.garantirTabelasESocial();
  const cfg = await repo.obterConfig();
  const erros = validarConfiguracao(cfg, tipo);
  if (erros.length) throw new ErroESocial(erros.join(' '));
  return cfg;
}

function ocorrenciasLocais(erros) {
  return erros.map((descricao) => ({ codigo: 'VALIDACAO', descricao, tipo: '1', localizacao: '' }));
}

async function exigirCompetenciaAberta(competencia, ambiente, acao) {
  const c = await repo.obterCompetencia(competencia, ambiente);
  if (c.status !== 'aberta') {
    throw new ErroESocial(`Competência ${competencia.split('-').reverse().join('/')} está ${c.status}: ${acao} bloqueado.`, 409);
  }
}

/** Preenche o código IBGE do município pelo CEP (ViaCEP) quando ainda não existe. */
async function completarCodigosMunicipio(cooperados) {
  const faltando = cooperados.filter((c) => !somenteDigitos(c.codigo_municipio_ibge) && somenteDigitos(c.cep).length === 8);
  await Promise.all(faltando.map(async (c) => {
    try {
      const resp = await fetch(`https://viacep.com.br/ws/${somenteDigitos(c.cep)}/json/`, { signal: AbortSignal.timeout(4000) });
      const dados = await resp.json();
      if (/^\d{7}$/.test(dados?.ibge ?? '')) {
        c.codigo_municipio_ibge = dados.ibge;
        await repo.salvarCodigoMunicipio(c.id, dados.ibge);
      }
    } catch { /* fica sem código: o evento será marcado como inválido com a explicação */ }
  }));
}

/**
 * Decide se a nova tentativa é original (1) ou retificação (2).
 * Retorna { indRetif, nrRecibo } ou { motivoIgnorado }.
 */
async function definirRetificacao({ tipo, ambiente, candidatoId, competencia, retificar }) {
  const ultimo = await repo.buscarUltimoEvento({ tipo, ambiente, candidatoId, competencia });
  if (ultimo && STATUS_EM_ANDAMENTO.includes(ultimo.status)) {
    return { motivoIgnorado: 'Aguardando retorno do eSocial da tentativa anterior.' };
  }
  if (ultimo?.status === 'aceito' && !retificar) {
    return { motivoIgnorado: 'Evento já aceito pelo eSocial. Use "Retificar" para corrigir valores ou dados.' };
  }
  const aceito = await repo.buscarUltimoEventoAceito({ tipo, ambiente, candidatoId, competencia });
  if (!aceito) return { indRetif: 1, nrRecibo: null };
  if (!aceito.nr_recibo) {
    return { motivoIgnorado: 'Cadastro registrado como enviado por outro sistema (sem recibo): a retificação deve ser feita no portal do eSocial.' };
  }
  return { indRetif: 2, nrRecibo: aceito.nr_recibo };
}

/** Carrega os dados e monta o XML de cada cooperado. */
async function prepararEventosCooperados({ tipo, cfg, competencia, candidatoIds, retificar }) {
  const ambiente = Number(cfg.ambiente);
  let fontes;
  if (tipo === 'S-2300') {
    fontes = await repo.buscarCooperadosParaCadastro(candidatoIds);
    await completarCodigosMunicipio(fontes);
  } else {
    fontes = await repo.buscarRemuneracoes(competencia, candidatoIds);
  }
  const porCandidato = new Map(fontes.map((f) => [Number(tipo === 'S-2300' ? f.id : f.candidato_id), f]));

  const resultado = [];
  for (const candidatoId of candidatoIds) {
    const fonte = porCandidato.get(Number(candidatoId));
    const base = { candidatoId: Number(candidatoId), nome: fonte?.nome ?? null, tipoContratacao: fonte?.tipo_contratacao ?? null };
    if (!fonte) {
      resultado.push({ ...base, ignorado: tipo === 'S-2300' ? 'Cooperado não encontrado.' : 'Sem remuneração importada nesta competência.' });
      continue;
    }

    const ret = await definirRetificacao({ tipo, ambiente, candidatoId: base.candidatoId, competencia: tipo === 'S-2300' ? null : competencia, retificar });
    if (ret.motivoIgnorado) {
      resultado.push({ ...base, ignorado: ret.motivoIgnorado });
      continue;
    }

    const erros = [];
    let perApur = tipo === 'S-2300' ? null : competencia;
    if (tipo === 'S-1200') {
      const cad = await repo.buscarUltimoEventoAceito({ tipo: 'S-2300', ambiente, candidatoId: base.candidatoId, competencia: null });
      if (!cad) erros.push('Cadastro do cooperado (S-2300) ainda não foi aceito pelo eSocial.');
    }
    if (tipo === 'S-1210') {
      const rem = await repo.buscarUltimoEventoAceito({ tipo: 'S-1200', ambiente, candidatoId: base.candidatoId, competencia });
      if (!rem) erros.push('Remuneração (S-1200) desta competência ainda não foi aceita pelo eSocial.');
      perApur = periodoPagamento(fonte.data_pagamento);
      if (perApur) {
        const periodo = await repo.obterCompetencia(perApur, ambiente);
        if (periodo.status !== 'aberta') erros.push(`Período do pagamento (${perApur.split('-').reverse().join('/')}) está ${periodo.status} no eSocial.`);
      }
    }

    const id = gerarIdEvento(cfg.tp_insc, cfg.nr_insc_empregador);
    const args = { cfg, competencia, indRetif: ret.indRetif, nrRecibo: ret.nrRecibo, id };
    const { xml, erros: errosLayout } = tipo === 'S-2300'
      ? montarS2300({ ...args, cooperado: fonte })
      : tipo === 'S-1200' ? montarS1200({ ...args, remun: fonte }) : montarS1210({ ...args, remun: fonte });

    resultado.push({
      ...base,
      id,
      xml,
      erros: [...erros, ...errosLayout],
      indRetif: ret.indRetif,
      perApur,
      remuneracaoId: fonte.id && tipo !== 'S-2300' ? fonte.id : null,
    });
  }
  return resultado;
}

/**
 * Assina e transmite um lote de eventos já validados.
 * @param {{ id, xml, candidatoId?, competencia?, perApur?, remuneracaoId?, indRetif }[]} itens
 */
async function transmitirLote({ cfg, tipo, competencia, itens, usuarioNome }) {
  const certificado = obterCertificado();
  const ambiente = Number(cfg.ambiente);
  const assinados = itens.map((i) => ({ ...i, xmlAssinado: assinarEvento(i.xml, certificado) }));

  const loteId = await repo.criarLote({ ambiente, grupo: TIPOS_EVENTO[tipo].grupo, tipo, competencia, qtd: assinados.length, usuarioNome });

  let retorno;
  try {
    for (const i of assinados) {
      await repo.inserirEvento({
        eventoId: i.id, ambiente, tipo, candidatoId: i.candidatoId, competencia: i.competencia ?? competencia ?? null,
        perApur: i.perApur, remuneracaoId: i.remuneracaoId, loteId, indRetif: i.indRetif, status: 'enviando',
        xml: i.xmlAssinado, usuarioNome,
      });
    }
    const xmlLote = montarLote({ cfg, grupo: TIPOS_EVENTO[tipo].grupo, eventos: assinados.map((i) => ({ id: i.id, xml: i.xmlAssinado })) });
    retorno = await wsEnviarLote({ cfg, xmlLote });
  } catch (e) {
    retorno = { aceito: false, protocolo: null, cdResposta: null, descResposta: `Falha na comunicação com o eSocial: ${e.message}`, ocorrencias: [] };
  }
  await repo.registrarRetornoEnvioLote(loteId, retorno);
  return { loteId, recebido: retorno.aceito, protocolo: retorno.protocolo, mensagem: retorno.descResposta };
}

/**
 * Envia UM lote (até 50 cooperados) de S-2300, S-1200 ou S-1210.
 * - Sem `candidatoIds`: pega os próximos cooperados que nunca tiveram esse evento.
 * - Com `candidatoIds`: reenvio/retificação de cooperados específicos.
 */
export async function enviarLoteCooperados({ tipo, competencia, candidatoIds, retificar = false, usuarioNome }) {
  if (!TIPOS_COOPERADO.includes(tipo)) throw new ErroESocial('Tipo de evento inválido.');
  if (tipo !== 'S-2300' && !competenciaValida(competencia)) throw new ErroESocial('Informe a competência (AAAA-MM).');
  const cfg = await carregarConfigValida(tipo);
  obterCertificado(); // falha cedo e com mensagem clara se o certificado não estiver configurado
  const ambiente = Number(cfg.ambiente);
  const comp = tipo === 'S-2300' ? null : competencia;

  return repo.comTrava(`esocial_envio_${ambiente}`, async () => {
    if (tipo === 'S-1200') await exigirCompetenciaAberta(competencia, ambiente, 'envio de remunerações');

    const explicito = Array.isArray(candidatoIds) && candidatoIds.length > 0;
    if (explicito && candidatoIds.length > MAX_EVENTOS_POR_LOTE) {
      throw new ErroESocial(`Envie no máximo ${MAX_EVENTOS_POR_LOTE} cooperados por vez.`);
    }
    const ids = explicito
      ? candidatoIds.map(Number)
      : tipo === 'S-2300'
        ? await repo.listarIdsSemCadastroESocial(ambiente, MAX_EVENTOS_POR_LOTE)
        : await repo.listarIdsRemuneracaoSemEvento(tipo, competencia, ambiente, MAX_EVENTOS_POR_LOTE);

    const preparados = await prepararEventosCooperados({ tipo, cfg, competencia, candidatoIds: ids, retificar });
    const invalidos = preparados.filter((p) => !p.ignorado && p.erros.length);
    const validos = preparados.filter((p) => !p.ignorado && !p.erros.length);
    const ignorados = preparados.filter((p) => p.ignorado);

    // Erros de cadastro ficam registrados como tentativa, com a descrição do problema
    for (const p of invalidos) {
      await repo.inserirEvento({
        ambiente, tipo, candidatoId: p.candidatoId, competencia: comp, perApur: p.perApur,
        remuneracaoId: p.remuneracaoId, indRetif: p.indRetif, status: 'invalido',
        descResposta: 'Não enviado: corrija o cadastro e reenvie.', ocorrencias: ocorrenciasLocais(p.erros), usuarioNome,
      });
    }

    let lote = null;
    if (validos.length) {
      lote = await transmitirLote({ cfg, tipo, competencia: comp, itens: validos.map((v) => ({ ...v, competencia: comp })), usuarioNome });
    }

    const restantes = explicito
      ? 0
      : tipo === 'S-2300'
        ? await repo.contarSemCadastroESocial(ambiente)
        : await repo.contarRemuneracaoSemEvento(tipo, competencia, ambiente);

    return {
      lote,
      enviados: lote?.recebido ? validos.length : 0,
      falhaEnvio: lote && !lote.recebido ? validos.length : 0,
      invalidos: invalidos.map((p) => ({ candidatoId: p.candidatoId, nome: p.nome, tipo_contratacao: p.tipoContratacao, erros: p.erros })),
      ignorados: ignorados.map((p) => ({ candidatoId: p.candidatoId, nome: p.nome, tipo_contratacao: p.tipoContratacao, motivo: p.ignorado })),
      restantes,
    };
  });
}

/** Registra que o cooperado já possui S-2300 no eSocial enviado por outro sistema. */
export async function marcarCadastroExistente({ candidatoIds, nrRecibo, usuarioNome }) {
  if (nrRecibo && !/^\d\.\d\.\d{19}$/.test(String(nrRecibo).trim())) {
    throw new ErroESocial('Número do recibo inválido (formato 1.1.0000000000000000000, 23 caracteres).');
  }
  nrRecibo = nrRecibo ? String(nrRecibo).trim() : null;
  await repo.garantirTabelasESocial();
  const cfg = await repo.obterConfig();
  const ambiente = Number(cfg.ambiente);
  let marcados = 0;
  for (const candidatoId of candidatoIds.map(Number)) {
    const aceito = await repo.buscarUltimoEventoAceito({ tipo: 'S-2300', ambiente, candidatoId, competencia: null });
    if (aceito) continue;
    await repo.inserirEvento({
      ambiente, tipo: 'S-2300', candidatoId, status: 'aceito', origem: 'externo',
      nrRecibo: nrRecibo || null, descResposta: 'Cadastro já existente no eSocial (enviado por outro sistema).', usuarioNome,
    });
    marcados++;
  }
  return { marcados };
}

// ── Retornos ──────────────────────────────────────────────────────────────────

/** Consulta até 3 lotes aguardando processamento (cabe no limite de tempo da requisição). */
export async function consultarRetornos() {
  await repo.garantirTabelasESocial();
  const cfg = await repo.obterConfig();
  const ambiente = Number(cfg.ambiente);
  const lotes = await repo.listarLotesAguardandoRetorno(ambiente, 3);
  const resultados = [];

  for (const lote of lotes) {
    let ret;
    try {
      ret = await wsConsultarLote({ cfg, protocolo: lote.protocolo });
    } catch (e) {
      await repo.registrarConsultaSemResultado(lote.id, { descResposta: `Falha ao consultar: ${e.message}` });
      resultados.push({ loteId: lote.id, processado: false, erro: e.message });
      continue;
    }
    if (!ret.processado) {
      await repo.registrarConsultaSemResultado(lote.id, ret);
      resultados.push({ loteId: lote.id, processado: false });
      continue;
    }
    await repo.registrarProcessamentoLote(lote.id, ret);
    await aplicarEfeitosDoLote(lote, ambiente);
    resultados.push({ loteId: lote.id, processado: true });
  }

  return { consultados: resultados, aguardando: await repo.contarLotesAguardandoRetorno(ambiente) };
}

/** Fechamento/reabertura só mudam a situação da competência depois do retorno do eSocial. */
async function aplicarEfeitosDoLote(lote, ambiente) {
  if (!['S-1299', 'S-1298'].includes(lote.tipo_evento)) return;
  const [ev] = await repo.buscarEventosDoLote(lote.id);
  if (!ev) return;
  const aceito = ev.status === 'aceito';
  if (lote.tipo_evento === 'S-1299') {
    if (aceito) {
      const tot = extrairTotaisApurados(ev.totalizadores_json ? JSON.parse(ev.totalizadores_json) : []);
      await repo.atualizarCompetencia(ev.competencia, ambiente, {
        status: 'fechada', fechada_em: new Date(), inss_apurado: tot.inss, irrf_apurado: tot.irrf,
      });
    } else {
      await repo.atualizarCompetencia(ev.competencia, ambiente, { status: 'aberta' });
    }
  } else {
    await repo.atualizarCompetencia(ev.competencia, ambiente, aceito
      ? { status: 'aberta', reaberta_em: new Date() }
      : { status: 'fechada' });
  }
}

// ── Competência: resumo, fechamento e reabertura ──────────────────────────────

function contarPorStatus(linhas, campo) {
  const r = { aceitos: 0, rejeitados: 0, aguardando: 0, pendentes: 0 };
  for (const l of linhas) {
    const s = l[campo];
    if (s === 'aceito') r.aceitos++;
    else if (s === 'rejeitado' || s === 'invalido' || s === 'erro_envio') r.rejeitados++;
    else if (STATUS_EM_ANDAMENTO.includes(s)) r.aguardando++;
    else r.pendentes++;
  }
  return r;
}

export async function resumoCompetencia(competencia) {
  if (!competenciaValida(competencia)) throw new ErroESocial('Competência inválida.');
  await repo.garantirTabelasESocial();
  const cfg = await repo.obterConfig();
  const ambiente = Number(cfg.ambiente);

  const [situacao, remuneracoes, pagamentos, s1299, s1298, lotesAguardando] = await Promise.all([
    repo.obterCompetencia(competencia, ambiente),
    repo.listarRemuneracoesComSituacao(competencia, ambiente),
    repo.listarPagamentosDoPeriodo(competencia, ambiente),
    repo.buscarUltimoEvento({ tipo: 'S-1299', ambiente, candidatoId: null, competencia }),
    repo.buscarUltimoEvento({ tipo: 'S-1298', ambiente, candidatoId: null, competencia }),
    repo.contarLotesAguardandoRetorno(ambiente),
  ]);

  const soma = (campo) => Math.round(remuneracoes.reduce((s, r) => s + Number(r[campo] || 0), 0) * 100) / 100;
  const s1200 = contarPorStatus(remuneracoes, 's1200_status');
  const s1210 = contarPorStatus(pagamentos, 's1210_status');

  const pendencias = [];
  if (s1200.pendentes + s1200.rejeitados + s1200.aguardando > 0) {
    pendencias.push(`${s1200.pendentes + s1200.rejeitados + s1200.aguardando} cooperado(s) sem remuneração (S-1200) aceita.`);
  }
  if (s1210.pendentes + s1210.rejeitados + s1210.aguardando > 0) {
    pendencias.push(`${s1210.pendentes + s1210.rejeitados + s1210.aguardando} pagamento(s) com data neste período sem S-1210 aceito.`);
  }
  if (lotesAguardando > 0) pendencias.push(`${lotesAguardando} lote(s) aguardando retorno do eSocial.`);
  if (!remuneracoes.length && !pagamentos.length) pendencias.push('Nenhuma remuneração importada e nenhum pagamento neste período.');

  const resumirEvento = (ev) => ev && ({
    status: ev.status, descResposta: ev.desc_resposta, nrRecibo: ev.nr_recibo, criadoEm: ev.criado_em,
    ocorrencias: ev.ocorrencias_json ? JSON.parse(ev.ocorrencias_json) : [],
  });

  return {
    competencia,
    ambiente,
    status: situacao.status,
    fechadaEm: situacao.fechada_em ?? null,
    fechamentoSolicitadoPor: situacao.fechamento_solicitado_por_nome ?? null,
    inssApuradoESocial: situacao.inss_apurado ?? null,
    irrfApuradoESocial: situacao.irrf_apurado ?? null,
    totais: { cooperados: remuneracoes.length, bruto: soma('valor_bruto'), inss: soma('valor_inss'), irrf: soma('valor_irrf') },
    s1200,
    s1210: { ...s1210, total: pagamentos.length },
    s1299: resumirEvento(s1299),
    s1298: resumirEvento(s1298),
    pendencias,
    podeFechar: situacao.status === 'aberta' && pendencias.length === 0,
  };
}

async function enviarEventoPeriodo({ tipo, competencia, cfg, usuarioNome, montar }) {
  const id = gerarIdEvento(cfg.tp_insc, cfg.nr_insc_empregador);
  const { xml, erros } = montar(id);
  if (erros.length) throw new ErroESocial(erros.join(' '));
  return transmitirLote({ cfg, tipo, competencia, itens: [{ id, xml, perApur: competencia, indRetif: 1 }], usuarioNome });
}

/**
 * Fecha a competência: trava novas movimentações e envia o S-1299.
 * A competência só fica "fechada" quando o eSocial aceita o S-1299.
 */
export async function fecharCompetencia({ competencia, usuarioNome }) {
  const resumo = await resumoCompetencia(competencia);
  if (resumo.status !== 'aberta') throw new ErroESocial(`Competência já está ${resumo.status}.`, 409);
  if (resumo.pendencias.length) throw new ErroESocial(`Não é possível fechar: ${resumo.pendencias.join(' ')}`, 409);

  const cfg = await carregarConfigValida('S-1299');
  obterCertificado();
  const ambiente = Number(cfg.ambiente);

  return repo.comTrava(`esocial_envio_${ambiente}`, async () => {
    const [temRemuneracao, temPagamento] = await Promise.all([
      repo.existeEventoAceitoNoPeriodo('S-1200', ambiente, competencia),
      repo.existeEventoAceitoNoPeriodo('S-1210', ambiente, competencia),
    ]);
    await repo.atualizarCompetencia(competencia, ambiente, {
      status: 'fechando', fechamento_solicitado_em: new Date(), fechamento_solicitado_por_nome: usuarioNome,
    });
    const lote = await enviarEventoPeriodo({
      tipo: 'S-1299', competencia, cfg, usuarioNome,
      montar: (id) => montarS1299({ cfg, competencia, temRemuneracao, temPagamento, id }),
    });
    if (!lote.recebido) await repo.atualizarCompetencia(competencia, ambiente, { status: 'aberta' });
    return lote;
  });
}

/** Reabre a competência no eSocial (S-1298). */
export async function reabrirCompetencia({ competencia, usuarioNome }) {
  if (!competenciaValida(competencia)) throw new ErroESocial('Competência inválida.');
  const cfg = await carregarConfigValida('S-1298');
  obterCertificado();
  const ambiente = Number(cfg.ambiente);
  const situacao = await repo.obterCompetencia(competencia, ambiente);
  if (situacao.status !== 'fechada') throw new ErroESocial('Somente competências fechadas podem ser reabertas.', 409);

  return repo.comTrava(`esocial_envio_${ambiente}`, async () => {
    await repo.atualizarCompetencia(competencia, ambiente, { status: 'reabrindo', reaberta_por_nome: usuarioNome });
    const lote = await enviarEventoPeriodo({
      tipo: 'S-1298', competencia, cfg, usuarioNome,
      montar: (id) => montarS1298({ cfg, competencia, id }),
    });
    if (!lote.recebido) await repo.atualizarCompetencia(competencia, ambiente, { status: 'fechada' });
    return lote;
  });
}

/** Usado por outros módulos (ex.: Financeiro) para impedir movimentações em período fechado. */
export async function competenciaBloqueada(competencia) {
  await repo.garantirTabelasESocial();
  const cfg = await repo.obterConfig();
  const c = await repo.obterCompetencia(competencia, Number(cfg.ambiente));
  return { competencia, status: c.status, bloqueada: c.status !== 'aberta' };
}

// ── Importação de remunerações ────────────────────────────────────────────────

function numero(v) {
  if (v === null || v === undefined || String(v).trim() === '') return null;
  let s = String(v).trim().replace(/[R$\s]/g, '');
  // Aceita "1.234,56" (pt-BR) e "1234.56"
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : NaN;
}

/**
 * @param {object[]} linhas  [{ matricula, cpf, valor_bruto, valor_inss, valor_irrf, valor_liquido?, data_pagamento, cnpj_estab?, cod_lotacao? }]
 * Retorna { importadas, erros: [{ linha, mensagem }] } — nada é gravado se houver erro.
 */
export async function importarRemuneracoes({ competencia, linhas, usuarioNome }) {
  if (!competenciaValida(competencia)) throw new ErroESocial('Competência inválida.');
  if (!Array.isArray(linhas) || !linhas.length) throw new ErroESocial('Planilha sem linhas.');
  await repo.garantirTabelasESocial();
  const cfg = await repo.obterConfig();
  await exigirCompetenciaAberta(competencia, Number(cfg.ambiente), 'importação de remunerações');

  const matriculas = [...new Set(linhas.map((l) => String(l.matricula ?? '').trim()).filter(Boolean))];
  const cpfs = [...new Set(linhas.map((l) => somenteDigitos(l.cpf)).filter((c) => c.length === 11))];
  const candidatos = await repo.buscarCandidatosPorMatriculaOuCpf(matriculas, cpfs);
  const porMatricula = new Map(candidatos.filter((c) => c.matricula).map((c) => [String(c.matricula).trim().toUpperCase(), c]));
  const porCpf = new Map(candidatos.map((c) => [somenteDigitos(c.cpf), c]));

  const erros = [];
  const validas = [];
  const vistos = new Set();
  linhas.forEach((l, i) => {
    const nLinha = Number(l.__linha ?? i + 2);
    const mat = String(l.matricula ?? '').trim().toUpperCase();
    const cpf = somenteDigitos(l.cpf);
    const cand = (mat && porMatricula.get(mat)) || (cpf && porCpf.get(cpf));
    const msgs = [];
    if (!cand) msgs.push(`cooperado não encontrado (matrícula "${l.matricula ?? ''}", CPF "${l.cpf ?? ''}")`);
    if (cand && mat && cpf && somenteDigitos(cand.cpf) !== cpf) msgs.push('matrícula e CPF pertencem a cooperados diferentes');
    if (cand && vistos.has(cand.id)) msgs.push('cooperado repetido na planilha');
    const bruto = numero(l.valor_bruto);
    const inss = numero(l.valor_inss) ?? 0;
    const irrf = numero(l.valor_irrf) ?? 0;
    const liquido = numero(l.valor_liquido);
    if (!(bruto > 0)) msgs.push('valor bruto inválido');
    if (Number.isNaN(inss) || inss < 0) msgs.push('valor de INSS inválido');
    if (Number.isNaN(irrf) || irrf < 0) msgs.push('valor de IRRF inválido');
    if (Number.isNaN(liquido) || (liquido !== null && liquido < 0)) msgs.push('valor líquido inválido');
    if (bruto > 0 && inss + irrf > bruto) msgs.push('descontos maiores que o valor bruto');
    const dataPagamento = normalizarData(l.data_pagamento);
    if (!dataPagamento) msgs.push('data de pagamento inválida (use DD/MM/AAAA)');
    else if (dataPagamento.slice(0, 7) < competencia) msgs.push('data de pagamento anterior à competência');
    const cnpjEstab = somenteDigitos(l.cnpj_estab);
    if (cnpjEstab && cnpjEstab.length !== 14) msgs.push('CNPJ do estabelecimento inválido');

    if (msgs.length) {
      erros.push({ linha: nLinha, mensagem: msgs.join('; ') });
      return;
    }
    vistos.add(cand.id);
    validas.push({
      candidatoId: cand.id, valorBruto: bruto, valorInss: inss, valorIrrf: irrf, valorLiquido: liquido,
      dataPagamento, cnpjEstab: cnpjEstab || null, codLotacao: String(l.cod_lotacao ?? '').trim() || null,
    });
  });

  if (erros.length) return { importadas: 0, erros };
  await repo.salvarRemuneracoes(competencia, validas, usuarioNome);
  return { importadas: validas.length, erros: [] };
}

export async function removerRemuneracao({ competencia, candidatoId }) {
  await repo.garantirTabelasESocial();
  const cfg = await repo.obterConfig();
  const ambiente = Number(cfg.ambiente);
  await exigirCompetenciaAberta(competencia, ambiente, 'alteração de remunerações');
  const s1200 = await repo.buscarUltimoEventoAceito({ tipo: 'S-1200', ambiente, candidatoId, competencia });
  if (s1200) throw new ErroESocial('Remuneração já aceita pelo eSocial: não pode ser removida pelo sistema (exige exclusão S-3000 no portal).', 409);
  await repo.removerRemuneracao(competencia, candidatoId);
}
