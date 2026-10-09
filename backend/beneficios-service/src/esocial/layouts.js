/**
 * Geração dos eventos do eSocial (leiaute S-1.3) usados pela cooperativa:
 *   S-2300 – Trabalhador sem vínculo (cooperado) – início
 *   S-1200 – Remuneração
 *   S-1210 – Pagamentos
 *   S-1299 – Fechamento dos eventos periódicos
 *   S-1298 – Reabertura dos eventos periódicos
 *
 * As funções aqui são puras: recebem dados já carregados do banco e devolvem
 * `{ xml, erros }`. Quando `erros` não está vazio o evento NÃO deve ser enviado;
 * as mensagens são exibidas ao usuário para correção do cadastro.
 */

export const TIPOS_EVENTO = {
  'S-2300': { raiz: 'evtTSVInicio', grupo: 2 },
  'S-1200': { raiz: 'evtRemun', grupo: 3 },
  'S-1210': { raiz: 'evtPgtos', grupo: 3 },
  'S-1299': { raiz: 'evtFechaEvPer', grupo: 3 },
  'S-1298': { raiz: 'evtReabreEvPer', grupo: 3 },
};

const VER_PROC = 'ATESA-ESOCIAL-1.0';

// ── Utilitários ───────────────────────────────────────────────────────────────

export function somenteDigitos(v) {
  return String(v ?? '').replace(/\D/g, '');
}

function esc(v) {
  return String(v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Normaliza texto livre: remove quebras/espaços duplicados e corta no tamanho máximo. */
function texto(v, max) {
  const t = String(v ?? '').replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
  return max ? t.slice(0, max).trim() : t;
}

/** Monta `<tag>valor</tag>`; omite a tag quando o valor é vazio/nulo. */
function tag(nome, valor) {
  if (valor === undefined || valor === null || valor === '') return '';
  return `<${nome}>${esc(valor)}</${nome}>`;
}

export function formatarValor(v) {
  return Number(v).toFixed(2);
}

export function cpfValido(cpf) {
  const c = somenteDigitos(cpf);
  if (c.length !== 11 || /^(\d)\1{10}$/.test(c)) return false;
  for (const t of [9, 10]) {
    let soma = 0;
    for (let i = 0; i < t; i++) soma += Number(c[i]) * (t + 1 - i);
    const dig = ((soma * 10) % 11) % 10;
    if (dig !== Number(c[t])) return false;
  }
  return true;
}

/** Aceita 'YYYY-MM-DD', 'YYYY-MM-DDTHH..', 'DD/MM/YYYY' ou Date. Retorna 'YYYY-MM-DD' ou null. */
export function normalizarData(v) {
  if (!v) return null;
  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) return null;
    const y = v.getFullYear(), m = String(v.getMonth() + 1).padStart(2, '0'), d = String(v.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return dataExiste(m[1], m[2], m[3]) ? `${m[1]}-${m[2]}-${m[3]}` : null;
  m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) return dataExiste(m[3], m[2], m[1]) ? `${m[3]}-${m[2]}-${m[1]}` : null;
  return null;
}

function dataExiste(y, m, d) {
  const dt = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
  return dt.getUTCFullYear() === Number(y) && dt.getUTCMonth() === Number(m) - 1 && dt.getUTCDate() === Number(d);
}

export function competenciaValida(c) {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(String(c ?? ''));
}

/**
 * Identificador do evento: ID + tpInsc + nrInsc (14 posições, completado com zeros
 * à direita) + AAAAMMDDHHMMSS + sequencial (5 dígitos). Total de 36 caracteres.
 */
let sequencialId = Math.floor(Math.random() * 90000);
export function gerarIdEvento(tpInsc, nrInscEmpregador, data = new Date()) {
  const p = (n, t = 2) => String(n).padStart(t, '0');
  const ts = `${data.getFullYear()}${p(data.getMonth() + 1)}${p(data.getDate())}${p(data.getHours())}${p(data.getMinutes())}${p(data.getSeconds())}`;
  sequencialId = (sequencialId + 1) % 100000;
  const nr = somenteDigitos(nrInscEmpregador).padEnd(14, '0');
  return `ID${tpInsc}${nr}${ts}${p(sequencialId, 5)}`;
}

/** Identificador do demonstrativo (ideDmDev) – único por trabalhador e período. */
export function gerarIdeDmDev(perRef, matricula) {
  return `REM${perRef.replace('-', '')}${somenteDigitos(matricula) || texto(matricula)}`.slice(0, 30);
}

// ── Conversões de cadastro para as tabelas do eSocial ─────────────────────────

function sexoESocial(genero) {
  const g = texto(genero).toLowerCase();
  if (g.startsWith('masc') || g === 'm') return 'M';
  if (g.startsWith('fem') || g === 'f') return 'F';
  return null;
}

/** Tabela racaCor: 1-Branca 2-Preta 3-Parda 4-Amarela 5-Indígena 6-Não informado. */
function racaCorESocial(cor) {
  const c = texto(cor).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (!c) return '6';
  if (c.startsWith('branc')) return '1';
  if (c.startsWith('pret') || c.startsWith('negr')) return '2';
  if (c.startsWith('pard')) return '3';
  if (c.startsWith('amarel') || c.startsWith('orient')) return '4';
  if (c.startsWith('indig')) return '5';
  return '6';
}

/** estCiv: 1-Solteiro 2-Casado 3-Divorciado 4-Separado 5-Viúvo. União estável não possui código (campo omitido). */
function estadoCivilESocial(ec) {
  const e = texto(ec).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  return { solteiro: '1', casado: '2', divorciado: '3', separado: '4', viuvo: '5' }[e] ?? null;
}

/** grauInstr (Tabela 01 do leiaute). */
function grauInstrucaoESocial(gi) {
  const g = texto(gi).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (!g) return null;
  if (g.includes('analfabet')) return '01';
  if (g.includes('doutorado')) return '12';
  if (g.includes('mestrado')) return '11';
  if (g.includes('pos')) return '10';
  if (g.includes('superior') && g.includes('incomplet')) return '08';
  if (g.includes('superior')) return '09';
  if (g.includes('medio') && g.includes('incomplet')) return '06';
  if (g.includes('medio')) return '07';
  if (g.includes('fundamental') && g.includes('incomplet')) return '04';
  if (g.includes('fundamental')) return '05';
  return null;
}

function ehBrasileiro(nacionalidade) {
  const n = texto(nacionalidade).toLowerCase();
  return !n || n.startsWith('brasil');
}

function ideEvento({ indRetif, nrRecibo, indApuracao, perApur, tpAmb, semRetificacao }) {
  return '<ideEvento>'
    + (semRetificacao ? '' : tag('indRetif', indRetif ?? 1) + (Number(indRetif) === 2 ? tag('nrRecibo', nrRecibo) : ''))
    + tag('indApuracao', indApuracao)
    + tag('perApur', perApur)
    + tag('tpAmb', tpAmb)
    + tag('procEmi', 1)
    + tag('verProc', VER_PROC)
    + '</ideEvento>';
}

function ideEmpregador(cfg) {
  return `<ideEmpregador>${tag('tpInsc', cfg.tp_insc)}${tag('nrInsc', nrInscEmpregador(cfg))}</ideEmpregador>`;
}

/** Para CNPJ o empregador é identificado pela raiz (8 dígitos). */
export function nrInscEmpregador(cfg) {
  const nr = somenteDigitos(cfg.nr_insc_empregador);
  return Number(cfg.tp_insc) === 1 ? nr.slice(0, 8) : nr;
}

function envelope(tipo, cfg, id, corpo) {
  const { raiz } = TIPOS_EVENTO[tipo];
  const ns = `http://www.esocial.gov.br/schema/evt/${raiz}/${cfg.versao_layout}`;
  return `<eSocial xmlns="${ns}"><${raiz} Id="${id}">${corpo}</${raiz}></eSocial>`;
}

export function validarConfiguracao(cfg, tipo) {
  const erros = [];
  const nr = somenteDigitos(cfg?.nr_insc_empregador);
  if (!cfg) return ['Configuração do eSocial não encontrada.'];
  if (Number(cfg.tp_insc) === 1 && nr.length !== 14) erros.push('Configuração: CNPJ do empregador deve ter 14 dígitos.');
  if (![1, 2].includes(Number(cfg.ambiente))) erros.push('Configuração: ambiente inválido.');
  if (!/^v_S_\d{2}_\d{2}_\d{2}$/.test(cfg.versao_layout || '')) erros.push('Configuração: versão de leiaute inválida (ex.: v_S_01_03_00).');
  if (tipo === 'S-1200') {
    if (somenteDigitos(cfg.cnpj_estab).length !== 14) erros.push('Configuração: CNPJ do estabelecimento (lotação) deve ter 14 dígitos.');
    if (!texto(cfg.cod_lotacao)) erros.push('Configuração: código da lotação tributária (S-1020) não informado.');
    if (!texto(cfg.rubrica_remuneracao)) erros.push('Configuração: rubrica de remuneração (S-1010) não informada.');
    if (!texto(cfg.ide_tab_rubr)) erros.push('Configuração: identificador da tabela de rubricas não informado.');
  }
  return erros;
}

// ── S-2300 ────────────────────────────────────────────────────────────────────

/** Categorias em que {natAtividade} é obrigatório no S-2300 (1 = trabalho urbano). */
const CATEGORIAS_COM_NAT_ATIVIDADE = ['201', '202', '401', '731', '734', '738'];

/**
 * @param {object} p
 * @param {object} p.cfg           configuração do eSocial
 * @param {object} p.cooperado     linha de ra_candidatos + ra_dados_sensiveis + alocação/vaga
 * @param {number} [p.indRetif]    1 = original, 2 = retificação
 * @param {string} [p.nrRecibo]    recibo do evento original (retificação)
 */
export function montarS2300({ cfg, cooperado: c, indRetif = 1, nrRecibo, id }) {
  const erros = [...validarConfiguracao(cfg, 'S-2300')];
  const cpf = somenteDigitos(c.cpf);
  if (!cpfValido(cpf)) erros.push('CPF inválido.');
  const nome = texto(c.nome, 70);
  if (nome.length < 2) erros.push('Nome do cooperado não informado.');
  const sexo = sexoESocial(c.genero);
  if (!sexo) erros.push('Sexo/gênero não informado (Masculino ou Feminino).');
  const grauInstr = grauInstrucaoESocial(c.grau_instrucao);
  if (!grauInstr) erros.push('Grau de instrução não informado.');
  const dtNascto = normalizarData(c.data_nascimento);
  if (!dtNascto) erros.push('Data de nascimento não informada ou inválida.');
  if (!ehBrasileiro(c.nacionalidade)) erros.push('Cooperado estrangeiro: envio automático não suportado, informe pelo portal do eSocial.');
  const matricula = texto(c.matricula, 30);
  if (!matricula) erros.push('Matrícula não gerada para o cooperado.');

  const cep = somenteDigitos(c.cep);
  if (cep.length !== 8) erros.push('CEP do endereço inválido.');
  const logradouro = texto(c.logradouro, 100);
  if (!logradouro) erros.push('Logradouro do endereço não informado.');
  const codMunic = somenteDigitos(c.codigo_municipio_ibge);
  if (codMunic.length !== 7) erros.push('Código IBGE do município não encontrado para o CEP informado.');
  const uf = texto(c.uf).toUpperCase();
  if (!/^[A-Z]{2}$/.test(uf)) erros.push('UF do endereço não informada.');

  const dtInicio = normalizarData(c.data_inicio_alocacao);
  if (!dtInicio) erros.push('Cooperado sem alocação: a data de início é obrigatória para o S-2300.');
  const cbo = somenteDigitos(c.cbo);
  if (cbo.length !== 6) erros.push('CBO do cargo não informado ou inválido (6 dígitos) na vaga ou no cadastro do cooperado.');
  if (Number(indRetif) === 2 && !nrRecibo) erros.push('Retificação sem recibo do evento original.');

  if (erros.length) return { xml: null, erros };

  const estCiv = estadoCivilESocial(c.estado_civil);
  const fone = somenteDigitos(c.telefone);
  const email = texto(c.email, 60);
  const contato = (fone.length >= 8 && fone.length <= 13 ? tag('fonePrinc', fone) : '')
    + (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? tag('emailPrinc', email) : '');

  // Grupo cargoFuncao é obrigatório para as categorias de cooperado
  const cargo = `<infoComplementares><cargoFuncao>${tag('nmCargo', texto(c.cargo || 'Cooperado', 100))}${tag('CBOCargo', cbo)}</cargoFuncao></infoComplementares>`;

  const corpo = ideEvento({ indRetif, nrRecibo, tpAmb: cfg.ambiente })
    + ideEmpregador(cfg)
    + '<trabalhador>'
    + tag('cpfTrab', cpf)
    + tag('nmTrab', nome)
    + tag('sexo', sexo)
    + tag('racaCor', racaCorESocial(c.cor_etnia))
    + tag('estCiv', estCiv)
    + tag('grauInstr', grauInstr)
    + tag('nmSoc', texto(c.nome_social, 70))
    + `<nascimento>${tag('dtNascto', dtNascto)}${tag('paisNascto', '105')}${tag('paisNac', '105')}</nascimento>`
    + '<endereco><brasil>'
    + tag('dscLograd', logradouro)
    + tag('nrLograd', texto(c.numero, 10) || 'S/N')
    + tag('complemento', texto(c.complemento, 30))
    + tag('bairro', texto(c.bairro, 90))
    + tag('cep', cep)
    + tag('codMunic', codMunic)
    + tag('uf', uf)
    + '</brasil></endereco>'
    + (contato ? `<contato>${contato}</contato>` : '')
    + '</trabalhador>'
    + '<infoTSVInicio>'
    + tag('cadIni', 'N')
    + tag('matricula', matricula)
    + tag('codCateg', cfg.cod_categ)
    + tag('dtInicio', dtInicio)
    + (CATEGORIAS_COM_NAT_ATIVIDADE.includes(String(cfg.cod_categ)) ? tag('natAtividade', 1) : '')
    + cargo
    + '</infoTSVInicio>';

  return { xml: envelope('S-2300', cfg, id, corpo), erros: [] };
}

// ── S-1200 ────────────────────────────────────────────────────────────────────

/**
 * @param {object} p.remun linha de esocial_remuneracoes (+ matricula, cpf)
 */
export function montarS1200({ cfg, competencia, remun: r, indRetif = 1, nrRecibo, id }) {
  const erros = [...validarConfiguracao(cfg, 'S-1200')];
  if (!competenciaValida(competencia)) erros.push('Competência inválida.');
  const cpf = somenteDigitos(r.cpf);
  if (!cpfValido(cpf)) erros.push('CPF inválido.');
  const matricula = texto(r.matricula, 30);
  if (!matricula) erros.push('Matrícula não informada.');
  const bruto = Number(r.valor_bruto);
  const inss = Number(r.valor_inss || 0);
  const irrf = Number(r.valor_irrf || 0);
  if (!(bruto > 0)) erros.push('Valor bruto da remuneração deve ser maior que zero.');
  if (inss < 0 || irrf < 0) erros.push('Valores de INSS/IRRF não podem ser negativos.');
  if (inss > 0 && !texto(cfg.rubrica_inss)) erros.push('Configuração: rubrica de INSS não informada.');
  if (irrf > 0 && !texto(cfg.rubrica_irrf)) erros.push('Configuração: rubrica de IRRF não informada.');
  const cnpjEstab = somenteDigitos(r.cnpj_estab || cfg.cnpj_estab);
  const codLotacao = texto(r.cod_lotacao || cfg.cod_lotacao, 30);
  if (Number(indRetif) === 2 && !nrRecibo) erros.push('Retificação sem recibo do evento original.');
  if (erros.length) return { xml: null, erros };

  const item = (codRubr, valor) => valor > 0
    ? `<itensRemun>${tag('codRubr', codRubr)}${tag('ideTabRubr', cfg.ide_tab_rubr)}${tag('vrRubr', formatarValor(valor))}${tag('indApurIR', 0)}</itensRemun>`
    : '';

  const corpo = ideEvento({ indRetif, nrRecibo, indApuracao: 1, perApur: competencia, tpAmb: cfg.ambiente })
    + ideEmpregador(cfg)
    + `<ideTrabalhador>${tag('cpfTrab', cpf)}</ideTrabalhador>`
    + '<dmDev>'
    + tag('ideDmDev', gerarIdeDmDev(competencia, matricula))
    + tag('codCateg', cfg.cod_categ)
    + '<infoPerApur><ideEstabLot>'
    + tag('tpInsc', 1)
    + tag('nrInsc', cnpjEstab)
    + tag('codLotacao', codLotacao)
    + '<remunPerApur>'
    + tag('matricula', matricula)
    + item(texto(cfg.rubrica_remuneracao), bruto)
    + item(texto(cfg.rubrica_inss), inss)
    + item(texto(cfg.rubrica_irrf), irrf)
    + '</remunPerApur>'
    + '</ideEstabLot></infoPerApur>'
    + '</dmDev>';

  return { xml: envelope('S-1200', cfg, id, corpo), erros: [] };
}

// ── S-1210 ────────────────────────────────────────────────────────────────────

export function calcularValorLiquido(r) {
  if (r.valor_liquido !== null && r.valor_liquido !== undefined && r.valor_liquido !== '') return Number(r.valor_liquido);
  return Math.round((Number(r.valor_bruto) - Number(r.valor_inss || 0) - Number(r.valor_irrf || 0)) * 100) / 100;
}

/** Período de apuração do S-1210 = mês da data de pagamento (regime de caixa). */
export function periodoPagamento(dataPagamento) {
  const d = normalizarData(dataPagamento);
  return d ? d.slice(0, 7) : null;
}

/**
 * @param {string} p.competencia competência da remuneração (perApur do S-1200), vira o {perRef}
 */
export function montarS1210({ cfg, competencia, remun: r, indRetif = 1, nrRecibo, id }) {
  const erros = [...validarConfiguracao(cfg, 'S-1210')];
  if (!competenciaValida(competencia)) erros.push('Competência inválida.');
  const cpf = somenteDigitos(r.cpf);
  if (!cpfValido(cpf)) erros.push('CPF inválido.');
  const dtPgto = normalizarData(r.data_pagamento);
  if (!dtPgto) erros.push('Data de pagamento não informada.');
  else if (dtPgto.slice(0, 7) < competencia) erros.push('Data de pagamento anterior à competência da remuneração.');
  const perApur = dtPgto ? dtPgto.slice(0, 7) : null;
  const perRef = competencia;
  const liquido = calcularValorLiquido(r);
  if (!(liquido >= 0)) erros.push('Valor líquido não pode ser negativo.');
  if (!texto(r.matricula)) erros.push('Matrícula não informada.');
  if (Number(indRetif) === 2 && !nrRecibo) erros.push('Retificação sem recibo do evento original.');
  if (erros.length) return { xml: null, erros };

  const corpo = ideEvento({ indRetif, nrRecibo, perApur, tpAmb: cfg.ambiente })
    + ideEmpregador(cfg)
    + '<ideBenef>'
    + tag('cpfBenef', cpf)
    + '<infoPgto>'
    + tag('dtPgto', dtPgto)
    + tag('tpPgto', 1)
    + tag('perRef', perRef)
    + tag('ideDmDev', gerarIdeDmDev(perRef, r.matricula))
    + tag('vrLiq', formatarValor(liquido))
    + '</infoPgto>'
    + '</ideBenef>';

  return { xml: envelope('S-1210', cfg, id, corpo), erros: [] };
}

// ── S-1299 / S-1298 ───────────────────────────────────────────────────────────

/**
 * {evtRemun}/{evtPgtos} devem ser 'S' somente se existirem S-1200/S-1210 no período.
 */
export function montarS1299({ cfg, competencia, temRemuneracao, temPagamento, id }) {
  const erros = [...validarConfiguracao(cfg, 'S-1299')];
  if (!competenciaValida(competencia)) erros.push('Competência inválida.');
  if (erros.length) return { xml: null, erros };
  const corpo = ideEvento({ semRetificacao: true, indApuracao: 1, perApur: competencia, tpAmb: cfg.ambiente })
    + ideEmpregador(cfg)
    + '<infoFech>'
    + tag('evtRemun', temRemuneracao ? 'S' : 'N')
    + tag('evtPgtos', temPagamento ? 'S' : 'N')
    + tag('evtComProd', 'N')
    + tag('evtContratAvNP', 'N')
    + tag('evtInfoComplPer', 'N')
    + '</infoFech>';
  return { xml: envelope('S-1299', cfg, id, corpo), erros: [] };
}

export function montarS1298({ cfg, competencia, id }) {
  const erros = [...validarConfiguracao(cfg, 'S-1298')];
  if (!competenciaValida(competencia)) erros.push('Competência inválida.');
  if (erros.length) return { xml: null, erros };
  const corpo = ideEvento({ semRetificacao: true, indApuracao: 1, perApur: competencia, tpAmb: cfg.ambiente })
    + ideEmpregador(cfg);
  return { xml: envelope('S-1298', cfg, id, corpo), erros: [] };
}
