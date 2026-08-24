import { apiGet, apiPatch, apiPost, apiPut, apiDelete } from './httpClient';

// ── Tipos ────────────────────────────────────────────────────────────────────

export interface DadosSensiveis {
  id?: number;
  candidato_id?: number;
  data_nascimento?: string;
  rg?: string;
  orgao_emissor?: string;
  uf_rg?: string;
  nome_mae?: string;
  nome_pai?: string;
  estado_civil?: 'solteiro' | 'casado' | 'divorciado' | 'viuvo' | 'uniao_estavel';
  naturalidade?: string;
  nacionalidade?: string;
  cep?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
  pis_pasep?: string;
  titulo_eleitor?: string;
  cnh?: string;
  categoria_cnh?: string;
  qualificacoes?: string;
}

export interface DadosBancarios {
  id?: number;
  candidato_id?: number;
  banco?: string;
  codigo_banco?: string;
  agencia?: string;
  conta?: string;
  digito?: string;
  tipo_conta?: 'corrente' | 'poupanca';
  chave_pix?: string;
  tipo_pix?: 'cpf' | 'email' | 'telefone' | 'aleatoria';
}

export type TipoDocumento =
  | 'foto_3x4' | 'rg_frente' | 'rg_verso' | 'cpf'
  | 'comprovante_residencia' | 'comprovante_bancario'
  | 'cnh' | 'certificado' | 'contrato' | 'outro';

export const ROTULO_TIPO_DOC: Record<TipoDocumento, string> = {
  foto_3x4:               'Foto 3x4',
  rg_frente:              'RG (frente)',
  rg_verso:               'RG (verso)',
  cpf:                    'CPF',
  comprovante_residencia: 'Comprovante de Residência',
  comprovante_bancario:   'Comprovante Bancário',
  cnh:                    'CNH',
  certificado:            'Certificado / Diploma',
  contrato:               'Contrato',
  outro:                  'Outro',
};

export interface Documento {
  id: number;
  candidato_id: number;
  tipo: TipoDocumento;
  nome_original: string;
  nome_arquivo: string;
  mime_type: string;
  tamanho_bytes: number;
  validado: 0 | 1;
  validado_por_nome: string | null;
  validado_em: string | null;
  rejeitado: 0 | 1;
  motivo_rejeicao: string | null;
  rejeitado_por_nome: string | null;
  rejeitado_em: string | null;
  observacao: string | null;
  enviado_em: string;
  enviado_por_nome: string | null;
}

export interface RegistroAuditoria {
  id: number;
  candidato_id: number;
  tabela: string;
  campo: string | null;
  acao: 'criacao' | 'edicao' | 'exclusao' | 'validacao' | 'rejeicao' | 'upload' | 'whatsapp' | 'notificacao';
  valor_anterior: string | null;
  valor_novo: string | null;
  observacao: string | null;
  usuario_id: number | null;
  usuario_nome: string | null;
  criado_em: string;
}

export interface QualificacaoCatalogo {
  id: number;
  nome: string;
  categoria: string | null;
  ativo: 0 | 1;
}

export interface CotaMensal {
  id: number;
  candidato_id: number;
  descricao: string;
  tipo: 'seguro_vida' | 'quota_parte' | 'inss' | 'outro';
  valor: number;
  total_parcelas: number | null;
  parcelas_pagas: number;
  recorrente: 0 | 1;
  ativa: 0 | 1;
  observacao: string | null;
  criado_em: string;
  atualizado_em: string;
}

export interface Descontos {
  id?: number;
  candidato_id?: number;
  inss_percentual?: number;
  seguro_vida_percentual?: number;
  quota_parte_valor?: number;
  quota_parcelada?: boolean | 0 | 1;
  quota_total_cotas?: number | null;
  quota_cotas_pagas?: number;
  rateio_percentual?: number;
  outras_descricao?: string;
  outras_valor?: number;
}

export interface AlertaBeneficio {
  id: number;
  candidato_id: number;
  candidato_nome: string;
  matricula: string | null;
  tipo: string;
  mensagem: string;
  lido: 0 | 1;
  criado_em: string;
}

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

// ── Dados Sensíveis ───────────────────────────────────────────────────────────

export function obterDadosSensiveis(candidatoId: number): Promise<DadosSensiveis> {
  return apiGet(`/beneficios/candidatos/${candidatoId}/dados-sensiveis`);
}

export function salvarDadosSensiveis(candidatoId: number, dados: DadosSensiveis): Promise<{ ok: boolean }> {
  return apiPut(`/beneficios/candidatos/${candidatoId}/dados-sensiveis`, dados);
}

// ── Dados Bancários ───────────────────────────────────────────────────────────

export function obterDadosBancarios(candidatoId: number): Promise<DadosBancarios> {
  return apiGet(`/beneficios/candidatos/${candidatoId}/dados-bancarios`);
}

export function salvarDadosBancarios(candidatoId: number, dados: DadosBancarios): Promise<{ ok: boolean }> {
  return apiPut(`/beneficios/candidatos/${candidatoId}/dados-bancarios`, dados);
}

// ── Documentos ────────────────────────────────────────────────────────────────

export function listarDocumentos(candidatoId: number): Promise<Documento[]> {
  return apiGet(`/beneficios/candidatos/${candidatoId}/documentos`);
}

/** Upload via FormData — NÃO usa apiPost pois é multipart */
export async function enviarDocumento(
  candidatoId: number,
  tipo: TipoDocumento,
  arquivo: File,
  token: string,
): Promise<{ id: number; nomeArquivo: string }> {
  const form = new FormData();
  form.append('tipo', tipo);
  form.append('arquivo', arquivo);
  const resp = await fetch(
    `${API}/api/beneficios/candidatos/${candidatoId}/documentos`,
    { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form }
  );
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error((err as { erro?: string }).erro ?? 'Erro ao enviar documento.');
  }
  return resp.json();
}

export function urlDownloadDocumento(docId: number): string {
  return `${API}/api/beneficios/documentos/${docId}/download`;
}

export function validarDocumento(docId: number): Promise<{ ok: boolean }> {
  return apiPatch(`/beneficios/documentos/${docId}/validar`, {});
}

export function rejeitarDocumento(docId: number, motivo: string): Promise<{ ok: boolean }> {
  return apiPatch(`/beneficios/documentos/${docId}/rejeitar`, { motivo });
}

export function removerDocumento(docId: number): Promise<{ ok: boolean }> {
  return apiDelete(`/beneficios/documentos/${docId}`);
}

// ── Descontos ─────────────────────────────────────────────────────────────────

export function obterDescontos(candidatoId: number): Promise<Descontos> {
  return apiGet(`/beneficios/candidatos/${candidatoId}/descontos`);
}

export function salvarDescontos(candidatoId: number, dados: Descontos): Promise<{ ok: boolean }> {
  return apiPut(`/beneficios/candidatos/${candidatoId}/descontos`, dados);
}

// ── Alertas ───────────────────────────────────────────────────────────────────

export function listarAlertas(lido?: boolean): Promise<AlertaBeneficio[]> {
  const qs = lido !== undefined ? `?lido=${lido ? '1' : '0'}` : '';
  return apiGet(`/beneficios/alertas${qs}`);
}

export function marcarAlertaLido(alertaId: number): Promise<{ ok: boolean }> {
  return apiPatch(`/beneficios/alertas/${alertaId}/lido`, {});
}

export function marcarTodosLidos(): Promise<{ ok: boolean }> {
  return apiPatch('/beneficios/alertas/marcar-todos-lidos', {});
}

// ── Auditoria ─────────────────────────────────────────────────────────────────

export function listarAuditoria(candidatoId: number, limite = 100): Promise<RegistroAuditoria[]> {
  return apiGet(`/beneficios/candidatos/${candidatoId}/auditoria?limite=${limite}`);
}

// ── Qualificações ─────────────────────────────────────────────────────────────

export function listarQualificacoesCatalogo(): Promise<QualificacaoCatalogo[]> {
  return apiGet('/beneficios/qualificacoes');
}

export function criarQualificacaoCatalogo(nome: string, categoria?: string): Promise<{ id: number }> {
  return apiPost('/beneficios/qualificacoes', { nome, categoria });
}

export function obterQualificacoesCandidato(candidatoId: number): Promise<QualificacaoCatalogo[]> {
  return apiGet(`/beneficios/candidatos/${candidatoId}/qualificacoes`);
}

export function salvarQualificacoesCandidato(candidatoId: number, ids: number[]): Promise<{ ok: boolean }> {
  return apiPut(`/beneficios/candidatos/${candidatoId}/qualificacoes`, { ids });
}

// ── Cotas Mensais ─────────────────────────────────────────────────────────────

export function listarCotasMensais(candidatoId: number): Promise<CotaMensal[]> {
  return apiGet(`/beneficios/candidatos/${candidatoId}/cotas-mensais`);
}

export function criarCotaMensal(candidatoId: number, dados: Partial<CotaMensal>): Promise<{ id: number }> {
  return apiPost(`/beneficios/candidatos/${candidatoId}/cotas-mensais`, dados);
}

export function atualizarCotaMensal(cotaId: number, dados: Partial<CotaMensal>): Promise<{ ok: boolean }> {
  return apiPut(`/beneficios/cotas-mensais/${cotaId}`, dados);
}

export function removerCotaMensal(cotaId: number): Promise<{ ok: boolean }> {
  return apiDelete(`/beneficios/cotas-mensais/${cotaId}`);
}

// ── WhatsApp ──────────────────────────────────────────────────────────────────

export function enviarWhatsApp(candidatoId: number): Promise<{ ok: boolean; enviado: boolean; link: string; telefone: string }> {
  return apiPost(`/beneficios/candidatos/${candidatoId}/notificar-whatsapp`, {});
}

// ── Integração: notificação de desligamento ───────────────────────────────────

export function notificarDesligamento(candidatoId: number, motivo?: string, dataDesligamento?: string): Promise<{ ok: boolean }> {
  return apiPost(`/beneficios/candidatos/${candidatoId}/notificar-desligamento`, { motivo, data_desligamento: dataDesligamento });
}
