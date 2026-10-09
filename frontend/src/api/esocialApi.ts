import { apiDelete, apiGet, apiPost, apiPut } from './httpClient';

// ── Tipos ────────────────────────────────────────────────────────────────────

export type TipoEventoCooperado = 'S-2300' | 'S-1200' | 'S-1210';

/** Situação de uma tentativa de envio. `null` = nunca enviado. */
export type StatusEventoESocial = 'invalido' | 'enviando' | 'enviado' | 'aceito' | 'rejeitado' | 'erro_envio';

export type StatusCompetencia = 'aberta' | 'fechando' | 'fechada' | 'reabrindo';

export interface OcorrenciaESocial {
  codigo: string;
  descricao: string;
  tipo: string;
  localizacao: string;
}

export interface ConfigESocial {
  tp_insc: number;
  nr_insc_empregador: string | null;
  cnpj_transmissor: string | null;
  ambiente: 1 | 2;
  versao_layout: string;
  cod_categ: string;
  cnpj_estab: string | null;
  cod_lotacao: string | null;
  rubrica_remuneracao: string | null;
  rubrica_inss: string | null;
  rubrica_irrf: string | null;
  ide_tab_rubr: string | null;
  atualizado_em?: string;
  atualizado_por_nome?: string | null;
}

export interface SituacaoCertificado {
  configurado: boolean;
  valido: boolean;
  titular?: string;
  cnpj?: string | null;
  validoAte?: string;
  erro?: string;
}

export interface CadastroESocial {
  candidato_id: number;
  nome: string;
  cpf: string;
  matricula: string | null;
  tipo_contratacao: string | null;
  status: StatusEventoESocial | null;
  cd_resposta: string | null;
  desc_resposta: string | null;
  ocorrencias: OcorrenciaESocial[];
  nr_recibo: string | null;
  ultima_tentativa_em: string | null;
  origem: 'sistema' | 'externo' | null;
  tentativas: number;
}

export interface RemuneracaoESocial {
  id: number;
  competencia: string;
  candidato_id: number;
  nome: string;
  cpf: string;
  matricula: string | null;
  tipo_contratacao: string | null;
  valor_bruto: string;
  valor_inss: string;
  valor_irrf: string;
  valor_liquido: string | null;
  data_pagamento: string | null;
  atualizado_em: string;
  s2300_status: StatusEventoESocial | null;
  s1200_status: StatusEventoESocial | null;
  s1200_desc: string | null;
  s1200_ocorrencias: OcorrenciaESocial[];
  s1200_recibo: string | null;
  s1200_em: string | null;
  s1200_tentativas: number;
  s1210_status: StatusEventoESocial | null;
  s1210_desc: string | null;
  s1210_ocorrencias: OcorrenciaESocial[];
  s1210_recibo: string | null;
  s1210_em: string | null;
  s1210_per_apur: string | null;
  s1210_tentativas: number;
}

export interface TentativaESocial {
  id: number;
  evento_id: string | null;
  tipo: string;
  competencia: string | null;
  per_apur: string | null;
  ind_retif: number;
  status: StatusEventoESocial;
  cd_resposta: string | null;
  desc_resposta: string | null;
  ocorrencias: OcorrenciaESocial[];
  nr_recibo: string | null;
  origem: 'sistema' | 'externo';
  enviado_por_nome: string | null;
  criado_em: string;
  atualizado_em: string;
  lote_id: number | null;
  protocolo: string | null;
}

export interface LoteESocial {
  id: number;
  tipo_evento: string;
  competencia: string | null;
  qtd_eventos: number;
  status: 'enviando' | 'enviado' | 'processado' | 'erro_envio' | 'erro_processamento';
  protocolo: string | null;
  cd_resposta: string | null;
  desc_resposta: string | null;
  enviado_em: string | null;
  processado_em: string | null;
  enviado_por_nome: string | null;
  aceitos: number;
  rejeitados: number;
}

export interface ResultadoEnvioLote {
  lote: { loteId: number; recebido: boolean; protocolo: string | null; mensagem: string } | null;
  enviados: number;
  falhaEnvio: number;
  invalidos: { candidatoId: number; nome: string | null; erros: string[] }[];
  ignorados: { candidatoId: number; nome: string | null; motivo: string }[];
  restantes: number;
}

export interface ContagemStatus {
  aceitos: number;
  rejeitados: number;
  aguardando: number;
  pendentes: number;
}

export interface EventoPeriodoResumo {
  status: StatusEventoESocial;
  descResposta: string | null;
  nrRecibo: string | null;
  criadoEm: string;
  ocorrencias: OcorrenciaESocial[];
}

export interface ResumoCompetencia {
  competencia: string;
  ambiente: 1 | 2;
  status: StatusCompetencia;
  fechadaEm: string | null;
  fechamentoSolicitadoPor: string | null;
  inssApuradoESocial: string | null;
  irrfApuradoESocial: string | null;
  totais: { cooperados: number; bruto: number; inss: number; irrf: number };
  s1200: ContagemStatus;
  s1210: ContagemStatus & { total: number };
  s1299: EventoPeriodoResumo | null;
  s1298: EventoPeriodoResumo | null;
  pendencias: string[];
  podeFechar: boolean;
}

export interface CompetenciaListada {
  competencia: string;
  status: StatusCompetencia;
  fechada_em: string | null;
  inss_apurado: string | null;
  irrf_apurado: string | null;
}

export interface LinhaImportacao {
  __linha: number;
  matricula?: string;
  cpf?: string;
  valor_bruto?: string;
  valor_inss?: string;
  valor_irrf?: string;
  valor_liquido?: string;
  data_pagamento?: string;
  cnpj_estab?: string;
  cod_lotacao?: string;
}

// ── Chamadas ─────────────────────────────────────────────────────────────────

const BASE = '/beneficios/esocial';

export function obterConfigESocial() {
  return apiGet<{ config: ConfigESocial; certificado: SituacaoCertificado; maxEventosPorLote: number }>(`${BASE}/config`);
}

export function salvarConfigESocial(config: Partial<ConfigESocial>) {
  return apiPut<{ config: ConfigESocial }>(`${BASE}/config`, config);
}

export function listarCadastrosESocial() {
  return apiGet<CadastroESocial[]>(`${BASE}/cadastros`);
}

export function marcarCadastrosExistentes(candidatoIds: number[], nrRecibo?: string) {
  return apiPost<{ marcados: number }>(`${BASE}/cadastros/marcar-existentes`, { candidatoIds, nrRecibo });
}

export function enviarLoteESocial(params: { tipo: TipoEventoCooperado; competencia?: string; candidatoIds?: number[]; retificar?: boolean }) {
  return apiPost<ResultadoEnvioLote>(`${BASE}/lotes/enviar`, params);
}

export function consultarRetornosESocial() {
  return apiPost<{ consultados: { loteId: number; processado: boolean; erro?: string }[]; aguardando: number }>(`${BASE}/lotes/consultar`, {});
}

export function listarLotesESocial() {
  return apiGet<LoteESocial[]>(`${BASE}/lotes`);
}

export function obterHistoricoESocial(candidatoId: number) {
  return apiGet<TentativaESocial[]>(`${BASE}/cooperados/${candidatoId}/historico`);
}

export function obterXmlEventoESocial(eventoId: number) {
  return apiGet<{ xml: string }>(`${BASE}/eventos/${eventoId}/xml`);
}

export function listarCompetenciasESocial() {
  return apiGet<CompetenciaListada[]>(`${BASE}/competencias`);
}

export function obterResumoCompetencia(competencia: string) {
  return apiGet<ResumoCompetencia>(`${BASE}/competencias/${competencia}`);
}

export function listarRemuneracoesESocial(competencia: string) {
  return apiGet<RemuneracaoESocial[]>(`${BASE}/competencias/${competencia}/remuneracoes`);
}

export function importarRemuneracoesESocial(competencia: string, linhas: LinhaImportacao[]) {
  return apiPost<{ importadas: number; erros: { linha: number; mensagem: string }[] }>(
    `${BASE}/competencias/${competencia}/remuneracoes/importar`, { linhas }
  );
}

export function removerRemuneracaoESocial(competencia: string, candidatoId: number) {
  return apiDelete<{ ok: boolean }>(`${BASE}/competencias/${competencia}/remuneracoes/${candidatoId}`);
}

export function fecharCompetenciaESocial(competencia: string) {
  return apiPost<{ loteId: number; recebido: boolean; protocolo: string | null; mensagem: string }>(
    `${BASE}/competencias/${competencia}/fechar`, { confirmaFaturamento: true }
  );
}

export function reabrirCompetenciaESocial(competencia: string) {
  return apiPost<{ loteId: number; recebido: boolean; protocolo: string | null; mensagem: string }>(
    `${BASE}/competencias/${competencia}/reabrir`, {}
  );
}
