import https from 'https';
import { XMLParser } from 'fast-xml-parser';
import { obterCertificado } from './certificado.js';
import { somenteDigitos, nrInscEmpregador } from './layouts.js';

/**
 * Cliente dos webservices de lote do eSocial (SOAP 1.1 com TLS mútuo).
 *
 * O eSocial aceita no máximo 50 eventos por lote. Cada chamada aqui envia ou
 * consulta UM lote, para caber no limite de tempo da função serverless (15s).
 */

export const MAX_EVENTOS_POR_LOTE = 50;
const TIMEOUT_MS = 12000;

const URLS = {
  1: {
    envio: 'https://webservices.envio.esocial.gov.br/servicos/empregador/enviarloteeventos/WsEnviarLoteEventos.svc',
    consulta: 'https://webservices.consulta.esocial.gov.br/servicos/empregador/consultarloteeventos/WsConsultarLoteEventos.svc',
  },
  2: {
    envio: 'https://webservices.producaorestrita.esocial.gov.br/servicos/empregador/enviarloteeventos/WsEnviarLoteEventos.svc',
    consulta: 'https://webservices.producaorestrita.esocial.gov.br/servicos/empregador/consultarloteeventos/WsConsultarLoteEventos.svc',
  },
};

const NS_SERVICO_ENVIO = 'http://www.esocial.gov.br/servicos/empregador/lote/eventos/envio/v1_1_0';
const NS_LOTE_ENVIO = 'http://www.esocial.gov.br/schema/lote/eventos/envio/v1_1_1';
const NS_SERVICO_CONSULTA = 'http://www.esocial.gov.br/servicos/empregador/lote/eventos/envio/consulta/retornoProcessamento/v1_0_0';
const NS_LOTE_CONSULTA = 'http://www.esocial.gov.br/schema/lote/eventos/envio/consulta/retornoProcessamento/v1_0_0';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  removeNSPrefix: true,
  parseTagValue: false,
  trimValues: true,
  isArray: (nome) => ['ocorrencia', 'evento', 'tot'].includes(nome),
});

function lista(v) {
  if (v === undefined || v === null || v === '') return [];
  return Array.isArray(v) ? v : [v];
}

function chamarSoap(url, soapAction, corpo) {
  const cert = obterCertificado();
  const dados = Buffer.from(corpo, 'utf8');
  return new Promise((resolve, reject) => {
    const req = https.request(url, {
      method: 'POST',
      key: cert.chavePem,
      cert: [cert.certPem, ...cert.cadeiaPem].join('\n'),
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'Content-Length': dados.length,
        SOAPAction: `"${soapAction}"`,
      },
      timeout: TIMEOUT_MS,
    }, (res) => {
      const partes = [];
      res.on('data', (p) => partes.push(p));
      res.on('end', () => {
        const texto = Buffer.concat(partes).toString('utf8');
        if (res.statusCode >= 500 && !texto.includes('Envelope')) {
          return reject(new Error(`eSocial indisponível (HTTP ${res.statusCode}).`));
        }
        if (res.statusCode === 403) {
          return reject(new Error('eSocial recusou o certificado digital (HTTP 403). Verifique se é um e-CNPJ A1 válido.'));
        }
        resolve(texto);
      });
    });
    req.on('timeout', () => req.destroy(new Error('Tempo de resposta do eSocial esgotado.')));
    req.on('error', reject);
    req.end(dados);
  });
}

function extrairFault(json) {
  const fault = json?.Envelope?.Body?.Fault;
  if (!fault) return null;
  return String(fault.faultstring?.['#text'] ?? fault.faultstring ?? 'Erro SOAP retornado pelo eSocial.');
}

function ocorrencias(no) {
  return lista(no?.ocorrencias?.ocorrencia).map((o) => ({
    codigo: String(o.codigo ?? ''),
    descricao: String(o.descricao ?? ''),
    tipo: String(o.tipo ?? ''),
    localizacao: String(o.localizacao ?? ''),
  }));
}

/**
 * Monta o XML do lote a partir dos eventos já assinados.
 * @param {{ id: string, xml: string }[]} eventos
 */
export function montarLote({ cfg, grupo, eventos }) {
  const transmissor = somenteDigitos(cfg.cnpj_transmissor || cfg.nr_insc_empregador);
  const evs = eventos
    .map((e) => `<evento Id="${e.id}">${e.xml.replace(/^<\?xml[^>]*\?>/, '')}</evento>`)
    .join('');
  return `<eSocial xmlns="${NS_LOTE_ENVIO}"><envioLoteEventos grupo="${grupo}">`
    + `<ideEmpregador><tpInsc>${cfg.tp_insc}</tpInsc><nrInsc>${nrInscEmpregador(cfg)}</nrInsc></ideEmpregador>`
    + `<ideTransmissor><tpInsc>${transmissor.length === 11 ? 2 : 1}</tpInsc><nrInsc>${transmissor}</nrInsc></ideTransmissor>`
    + `<eventos>${evs}</eventos>`
    + '</envioLoteEventos></eSocial>';
}

/**
 * Envia um lote. Retorna { aceito, protocolo, cdResposta, descResposta, ocorrencias, xmlRetorno }.
 * `aceito` indica apenas que o lote foi RECEBIDO; o resultado de cada evento vem na consulta.
 */
export async function enviarLote({ cfg, xmlLote }) {
  const envelope = '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" '
    + `xmlns:v1="${NS_SERVICO_ENVIO}"><soapenv:Header/><soapenv:Body>`
    + `<v1:EnviarLoteEventos><v1:loteEventos>${xmlLote}</v1:loteEventos></v1:EnviarLoteEventos>`
    + '</soapenv:Body></soapenv:Envelope>';
  const xmlRetorno = await chamarSoap(URLS[cfg.ambiente].envio, `${NS_SERVICO_ENVIO}/ServicoEnviarLoteEventos/EnviarLoteEventos`, envelope);
  return interpretarRetornoEnvio(xmlRetorno);
}

export function interpretarRetornoEnvio(xmlRetorno) {
  const json = parser.parse(xmlRetorno);
  const fault = extrairFault(json);
  if (fault) return { aceito: false, protocolo: null, cdResposta: null, descResposta: fault, ocorrencias: [], xmlRetorno };
  const ret = json?.Envelope?.Body?.EnviarLoteEventosResponse?.EnviarLoteEventosResult?.eSocial?.retornoEnvioLoteEventos;
  if (!ret) return { aceito: false, protocolo: null, cdResposta: null, descResposta: 'Resposta do eSocial em formato inesperado.', ocorrencias: [], xmlRetorno };
  const cd = String(ret.status?.cdResposta ?? '');
  return {
    aceito: cd === '201',
    protocolo: ret.dadosRecepcaoLote?.protocoloEnvio ? String(ret.dadosRecepcaoLote.protocoloEnvio) : null,
    cdResposta: cd,
    descResposta: String(ret.status?.descResposta ?? ''),
    ocorrencias: ocorrencias(ret.status),
    xmlRetorno,
  };
}

/**
 * Consulta o processamento de um lote.
 * Retorna { processado, cdResposta, descResposta, ocorrencias, eventos: [{ id, aceito, cdResposta, descResposta, ocorrencias, nrRecibo, totalizadores }] }.
 */
export async function consultarLote({ cfg, protocolo }) {
  const envelope = '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" '
    + `xmlns:v1="${NS_SERVICO_CONSULTA}"><soapenv:Header/><soapenv:Body>`
    + `<v1:ConsultarLoteEventos><v1:consulta><eSocial xmlns="${NS_LOTE_CONSULTA}"><consultaLoteEventos>`
    + `<protocoloEnvio>${protocolo}</protocoloEnvio>`
    + '</consultaLoteEventos></eSocial></v1:consulta></v1:ConsultarLoteEventos>'
    + '</soapenv:Body></soapenv:Envelope>';
  const xmlRetorno = await chamarSoap(URLS[cfg.ambiente].consulta, `${NS_SERVICO_CONSULTA}/ServicoConsultarLoteEventos/ConsultarLoteEventos`, envelope);
  return interpretarRetornoConsulta(xmlRetorno);
}

export function interpretarRetornoConsulta(xmlRetorno) {
  const json = parser.parse(xmlRetorno);
  const fault = extrairFault(json);
  if (fault) return { processado: false, falha: true, cdResposta: null, descResposta: fault, ocorrencias: [], eventos: [], xmlRetorno };
  const ret = json?.Envelope?.Body?.ConsultarLoteEventosResponse?.ConsultarLoteEventosResult?.eSocial?.retornoProcessamentoLoteEventos;
  if (!ret) return { processado: false, falha: true, cdResposta: null, descResposta: 'Resposta do eSocial em formato inesperado.', ocorrencias: [], eventos: [], xmlRetorno };

  const cd = String(ret.status?.cdResposta ?? '');
  const eventos = lista(ret.retornoEventos?.evento).map((ev) => {
    const r = ev.retornoEvento?.eSocial?.retornoEvento ?? {};
    const cdEv = String(r.processamento?.cdResposta ?? '');
    return {
      id: String(ev['@_Id'] ?? ''),
      // 201 = sucesso; 202 = sucesso com advertência
      aceito: cdEv === '201' || cdEv === '202',
      cdResposta: cdEv,
      descResposta: String(r.processamento?.descResposta ?? ''),
      ocorrencias: ocorrencias(r.processamento),
      nrRecibo: r.recibo?.nrRecibo ? String(r.recibo.nrRecibo) : null,
      totalizadores: lista(ev.tot).map((t) => ({ tipo: String(t['@_tipo'] ?? ''), dados: t.eSocial ?? t })),
    };
  });

  return {
    // 101 = lote aguardando processamento; demais códigos são finais
    processado: cd !== '101',
    falha: cd !== '101' && cd !== '201',
    cdResposta: cd,
    descResposta: String(ret.status?.descResposta ?? ''),
    tempoEstimadoSegundos: Number(ret.status?.tempoEstimadoConclusao ?? 0) || null,
    ocorrencias: ocorrencias(ret.status),
    eventos,
    xmlRetorno,
  };
}

/**
 * Soma os campos `campos` encontrados abaixo de qualquer nó chamado `grupo`.
 * Ex.: INSS consolidado = vrCR dentro de infoCRContrib (o S-5011 repete vrCR
 * por estabelecimento em infoCREstab, que não deve ser somado).
 */
function somarCampos(no, grupo, campos, dentro = false) {
  let total = 0;
  if (Array.isArray(no)) return no.reduce((s, n) => s + somarCampos(n, grupo, campos, dentro), 0);
  if (!no || typeof no !== 'object') return 0;
  for (const [k, filho] of Object.entries(no)) {
    if (dentro && campos.includes(k)) {
      for (const v of lista(filho)) total += Number(String(v).replace(',', '.')) || 0;
    } else {
      total += somarCampos(filho, grupo, campos, dentro || k === grupo);
    }
  }
  return total;
}

/**
 * Totais apurados pelo eSocial a partir dos totalizadores devolvidos no S-1299:
 *   S-5011 – contribuições sociais consolidadas (INSS): infoCRContrib/vrCR
 *   S-5012 – IRRF consolidado: infoCRMen/vrCRMen e infoCRDia/vrCRDia
 */
export function extrairTotaisApurados(totalizadores) {
  const arred = (v) => Math.round(v * 100) / 100;
  let inss = null;
  let irrf = null;
  for (const t of totalizadores ?? []) {
    if (t.tipo === 'S5011') inss = arred((inss ?? 0) + somarCampos(t.dados, 'infoCRContrib', ['vrCR']));
    if (t.tipo === 'S5012') {
      irrf = arred((irrf ?? 0)
        + somarCampos(t.dados, 'infoCRMen', ['vrCRMen'])
        + somarCampos(t.dados, 'infoCRDia', ['vrCRDia']));
    }
  }
  return { inss, irrf };
}
