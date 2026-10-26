import { apiGet, apiPost, apiPut, apiDelete, apiGetBlob } from './httpClient';

// ── Tipos ────────────────────────────────────────────────────────────────────
export type Papel = 'consultor' | 'executivo';
export type BaseCalculo = 'nao_definida' | 'valor_nf_servicos' | 'valor_recebido' | 'manual';
export type ReferenciaVigencia = 'nao_definida' | 'competencia' | 'emissao_nf';
export type SituacaoComissao = 'aguardando_regra' | 'aguardando_base' | 'calculada' | 'conferida' | 'contestada';

export interface UsuarioComissionavel { id: number; nome: string; tipo_usuario: string; eh_executivo: number }

export interface OpcoesComissao {
  usuarios: UsuarioComissionavel[];
  bases: Record<BaseCalculo, string>;
  referencias: Record<ReferenciaVigencia, string>;
}

export interface RegraComissao {
  id: number;
  papel: Papel;
  usuario_id: number | null;
  usuario_nome: string | null;
  empresa_id: number | null;
  nome_empresa: string | null;
  percentual: string;
  base_calculo: BaseCalculo;
  referencia_vigencia: ReferenciaVigencia;
  vigencia_inicio: string;
  vigencia_fim: string | null;
  confirmada: number;
  confirmacao_referencia: string | null;
  confirmada_por_nome: string | null;
  confirmada_em: string | null;
  ativa: number;
  observacao: string | null;
}

export interface DadosRegraComissao {
  papel?: Papel;
  usuarioId?: number | '';
  empresaId?: number | '';
  percentual?: string;
  baseCalculo?: BaseCalculo;
  referenciaVigencia?: ReferenciaVigencia;
  vigenciaInicio?: string;
  vigenciaFim?: string;
  observacao?: string;
}

export interface Responsavel { id: number; papel: Papel; usuario_id: number; usuario_nome: string; origem: 'empresa' | 'manual' }
export interface ResponsaveisProcesso {
  responsaveis: Responsavel[];
  sugestoes: { papel: Papel; usuario_id: number; usuario_nome: string }[];
  avisos: string[];
}

export interface Comissao {
  id: number;
  processo_id: number;
  processo_codigo: string;
  competencia: string;
  nome_empresa: string;
  responsavel_id: number;
  usuario_id: number;
  usuario_nome: string;
  papel: Papel;
  regra_id: number | null;
  percentual: string | null;
  base_calculo: BaseCalculo | null;
  base_valor: string | null;
  base_manual_motivo: string | null;
  valor: string | null;
  situacao: SituacaoComissao;
  motivo_situacao: string | null;
  conferido_por_nome: string | null;
  regra_confirmada: number | null;
  confirmacao_referencia: string | null;
}

export type ModoIntegracao = 'nao_analisado' | 'manual' | 'api_nacional' | 'webservice_municipal' | 'rpa';
export type SituacaoMunicipio = 'nao_analisado' | 'em_analise' | 'aguardando_acesso' | 'viavel' | 'inviavel';
export interface Municipio {
  id: number;
  municipio: string;
  uf: string;
  codigo_ibge: string | null;
  sistema: string | null;
  url: string | null;
  modo_integracao: ModoIntegracao;
  situacao: SituacaoMunicipio;
  requisitos: string | null;
  pendencias: string | null;
  observacoes: string | null;
  atualizado_por_nome: string | null;
  atualizado_em: string;
  prefeitura_emissora: number;
}
export interface CidadeCliente { municipio: string; uf: string; clientes: number; clientes_sem_uf: number; municipio_id: number | null; situacao: SituacaoMunicipio | null }
export interface ListaMunicipios {
  municipios: Municipio[];
  /** Prefeituras em que a ATESA emite NFS-e */
  emissoras: Municipio[];
  emissora: Municipio | null;
  cidades_clientes: CidadeCliente[];
  cidades_clientes_sem_analise: CidadeCliente[];
  clientes_sem_uf: { municipio: string; clientes: number }[];
  clientes_sem_cidade: number;
}

export interface DocumentoFinanceiro { id: number; tipo: string; nome_arquivo: string; tamanho: number; enviado_por_nome: string | null; criado_em: string }

export interface NotaFiscal {
  id: number;
  processo_id: number;
  municipio_id: number | null;
  municipio_emissor: string | null;
  uf_emissor: string | null;
  municipio_situacao: SituacaoMunicipio | null;
  status: 'rascunho' | 'emitida' | 'cancelada';
  numero: string | null;
  serie: string | null;
  codigo_verificacao: string | null;
  data_emissao: string | null;
  competencia: string;
  prestador_nome: string | null;
  prestador_cnpj: string | null;
  tomador_nome: string | null;
  tomador_documento: string | null;
  tomador_endereco: string | null;
  tomador_municipio: string | null;
  tomador_uf: string | null;
  codigo_servico: string | null;
  discriminacao: string | null;
  valor_servicos: string;
  valor_deducoes: string;
  aliquota_iss: string | null;
  valor_iss: string;
  iss_retido: number;
  valor_pis: string;
  valor_cofins: string;
  valor_csll: string;
  valor_irrf: string;
  valor_inss: string;
  outras_retencoes: string;
  valor_liquido: string | null;
  motivo_cancelamento: string | null;
  documentos: DocumentoFinanceiro[];
}

export type FormaCobranca = 'boleto' | 'pix' | 'transferencia' | 'deposito' | 'outro';
export type StatusCobranca = 'aberta' | 'parcial' | 'paga' | 'divergente' | 'cancelada';
export interface Cobranca {
  id: number;
  codigo: string;
  processo_id: number;
  processo_codigo: string;
  competencia: string;
  nome_empresa: string;
  nota_id: number | null;
  nota_numero: string | null;
  valor: string;
  vencimento: string;
  forma: FormaCobranca;
  banco_codigo: string | null;
  nosso_numero: string | null;
  linha_digitavel: string | null;
  status: StatusCobranca;
  valor_recebido: string;
  saldo: string;
  vencida: number;
  observacao: string | null;
  motivo_cancelamento: string | null;
}

export type ClassificacaoPagamento = 'integral' | 'parcial' | 'a_maior' | 'nao_identificado' | 'cobranca_cancelada' | 'ja_quitada' | 'duplicado';
export interface RetornoBancario {
  id: number;
  layout: string;
  banco_codigo: string | null;
  nome_arquivo: string;
  sha256: string;
  status: 'pendente' | 'processado' | 'descartado';
  total_registros: number;
  valor_total: string;
  resumo: Partial<Record<ClassificacaoPagamento, { quantidade: number; valor: number }>>;
  importado_por_nome: string | null;
  importado_em: string;
  processado_por_nome: string | null;
  processado_em: string | null;
  motivo_descarte: string | null;
  documento_id: number | null;
}
export interface LinhaRetorno {
  id: number;
  linha_numero: number;
  identificador: string;
  data_pagamento: string;
  valor_pago: string;
  pagador_nome: string | null;
  cobranca_id: number | null;
  cobranca_codigo: string | null;
  nome_empresa: string | null;
  classificacao: ClassificacaoPagamento;
  mensagem: string | null;
  recebimento_id: number | null;
}

export interface Recebimento {
  id: number;
  cobranca_id: number | null;
  cobranca_codigo: string | null;
  nome_empresa: string | null;
  processo_codigo: string | null;
  origem: 'retorno' | 'manual';
  identificador: string | null;
  data_pagamento: string;
  data_credito: string | null;
  valor: string;
  pagador_nome: string | null;
  situacao: 'ativo' | 'estornado';
  observacao: string | null;
  motivo: string | null;
  autorizado_por_nome: string | null;
  criado_por_nome: string | null;
  motivo_estorno: string | null;
}

export interface AuditoriaFinanceira {
  id: number;
  entidade: string;
  entidade_id: number | null;
  processo_id: number | null;
  acao: string;
  campo: string | null;
  valor_anterior: string | null;
  valor_novo: string | null;
  motivo: string | null;
  usuario_nome: string | null;
  usuario_perfil: string | null;
  criado_em: string;
}

/** Erro da API com os detalhes de validação (ex.: linhas inválidas do arquivo de retorno). */
export interface ErroComDetalhes extends Error { detalhes?: string[]; codigo?: string }

function q(params: Record<string, unknown>): string {
  const s = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') s.append(k, String(v));
  const t = s.toString();
  return t ? `?${t}` : '';
}

const FAT = '/supervisao/faturamento';
const FIN = '/supervisao/financeiro';

// ── Arquivos ────────────────────────────────────────────────────────────────
export function lerArquivoBase64(arquivo: File): Promise<{ nomeArquivo: string; conteudoBase64: string }> {
  return new Promise((resolve, reject) => {
    if (arquivo.size > 3 * 1024 * 1024) { reject(new Error('Arquivo maior que 3 MB.')); return; }
    const leitor = new FileReader();
    leitor.onload = () => resolve({ nomeArquivo: arquivo.name, conteudoBase64: String(leitor.result).replace(/^data:[^;]*;base64,/, '') });
    leitor.onerror = () => reject(new Error('Não foi possível ler o arquivo.'));
    leitor.readAsDataURL(arquivo);
  });
}

async function baixarBlob(caminho: string, nome: string) {
  const blob = await apiGetBlob(caminho);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

export const baixarDocumentoFinanceiro = (id: number, nome: string) => baixarBlob(`${FIN}/documentos/${id}`, nome);
export const baixarModeloRetornoCsv = () => baixarBlob(`${FIN}/retornos/modelo-csv`, 'modelo-retorno-recebimentos.csv');

/** POST que preserva os detalhes de validação devolvidos pelo servidor. */
async function postComDetalhes<T>(caminho: string, corpo: unknown): Promise<T> {
  const API_URL = import.meta.env.VITE_API_URL || '/api';
  const token = localStorage.getItem('atesa_token');
  const r = await fetch(`${API_URL}${caminho}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(corpo),
  });
  const dados = await r.json().catch(() => null);
  if (!r.ok) {
    const e: ErroComDetalhes = new Error(dados?.erro || `Erro na requisição (${r.status}).`);
    e.detalhes = dados?.detalhes;
    e.codigo = dados?.codigo;
    throw e;
  }
  return dados as T;
}

// ── Comissões ───────────────────────────────────────────────────────────────
export const obterOpcoesComissao = () => apiGet<OpcoesComissao>(`${FAT}/comissoes/opcoes`);
export const listarRegrasComissao = (incluirInativas = false) => apiGet<RegraComissao[]>(`${FAT}/comissoes/regras${q({ incluirInativas })}`);
export const criarRegraComissao = (d: DadosRegraComissao) => apiPost<{ ok: boolean; id: number }>(`${FAT}/comissoes/regras`, d);
export const atualizarRegraComissao = (id: number, d: DadosRegraComissao) => apiPut<{ ok: boolean }>(`${FAT}/comissoes/regras/${id}`, d);
export const confirmarRegraComissao = (id: number, confirmacaoReferencia: string) => apiPost<{ ok: boolean }>(`${FAT}/comissoes/regras/${id}/confirmar`, { confirmacaoReferencia });
export const inativarRegraComissao = (id: number, motivo: string) => apiPost<{ ok: boolean }>(`${FAT}/comissoes/regras/${id}/inativar`, { motivo });

export const listarResponsaveis = (processoId: number) => apiGet<ResponsaveisProcesso>(`${FAT}/processos/${processoId}/responsaveis`);
export const vincularResponsaveisDaEmpresa = (processoId: number) => apiPost<{ ok: boolean; incluidos: number; avisos: string[] }>(`${FAT}/processos/${processoId}/responsaveis/da-empresa`, {});
export const adicionarResponsavel = (processoId: number, papel: Papel, usuarioId: number) => apiPost<{ ok: boolean }>(`${FAT}/processos/${processoId}/responsaveis`, { papel, usuarioId });
export const removerResponsavel = (processoId: number, responsavelId: number, motivo: string) => apiDelete<{ ok: boolean }>(`${FAT}/processos/${processoId}/responsaveis/${responsavelId}${q({ motivo })}`);
export const calcularComissoes = (processoId: number) => apiPost<{ ok: boolean; calculadas: number; aguardando: number; conferidas_mantidas: number; conferidas_alteradas: number }>(`${FAT}/processos/${processoId}/comissoes/calcular`, {});
export const listarComissoes = (f: { processoId?: number; competencia?: string; situacao?: string } = {}) => apiGet<Comissao[]>(`${FAT}/comissoes${q(f)}`);
export const informarBaseManualComissao = (id: number, valor: string, motivo: string) => apiPost<{ ok: boolean }>(`${FAT}/comissoes/${id}/base-manual`, { valor, motivo });
export const conferirComissao = (id: number) => apiPost<{ ok: boolean }>(`${FAT}/comissoes/${id}/conferir`, {});
export const contestarComissao = (id: number, motivo: string) => apiPost<{ ok: boolean }>(`${FAT}/comissoes/${id}/contestar`, { motivo });
export const reabrirComissao = (id: number, motivo: string) => apiPost<{ ok: boolean }>(`${FAT}/comissoes/${id}/reabrir`, { motivo });

// ── Prefeituras, notas fiscais e cobranças ──────────────────────────────────
export const listarMunicipios = () => apiGet<ListaMunicipios>(`${FAT}/municipios`);
export const salvarMunicipio = (id: number | null, d: Record<string, unknown>) =>
  id ? apiPut<{ ok: boolean; id: number }>(`${FAT}/municipios/${id}`, d) : apiPost<{ ok: boolean; id: number }>(`${FAT}/municipios`, d);
export const excluirMunicipio = (id: number) => apiDelete<{ ok: boolean }>(`${FAT}/municipios/${id}`);

export const listarNotas = (processoId: number) => apiGet<NotaFiscal[]>(`${FAT}/processos/${processoId}/notas`);
export const criarNota = (processoId: number, d: Record<string, unknown>) => apiPost<{ ok: boolean; id: number }>(`${FAT}/processos/${processoId}/notas`, d);
export const atualizarNota = (id: number, d: Record<string, unknown>) => apiPut<{ ok: boolean }>(`${FAT}/notas/${id}`, d);
export const registrarEmissaoNota = (id: number, d: { numero: string; serie?: string; codigoVerificacao?: string; dataEmissao: string }) => apiPost<{ ok: boolean }>(`${FAT}/notas/${id}/registrar-emissao`, d);
export const emitirNotaAutomaticamente = (id: number) => apiPost<never>(`${FAT}/notas/${id}/emitir-automatico`, {});
export const cancelarNota = (id: number, motivo: string) => apiPost<{ ok: boolean }>(`${FAT}/notas/${id}/cancelar`, { motivo });
export const anexarDocumentoNota = (id: number, tipo: 'pdf' | 'xml', arquivo: { nomeArquivo: string; conteudoBase64: string }) =>
  apiPost<{ ok: boolean; id: number }>(`${FAT}/notas/${id}/documentos`, { tipo, ...arquivo });

export const listarCobrancasProcesso = (processoId: number) => apiGet<Cobranca[]>(`${FAT}/processos/${processoId}/cobrancas`);
export const criarCobranca = (processoId: number, d: Record<string, unknown>) => apiPost<{ ok: boolean; id: number; codigo: string }>(`${FAT}/processos/${processoId}/cobrancas`, d);
export const atualizarCobranca = (id: number, d: Record<string, unknown>) => apiPut<{ ok: boolean }>(`${FAT}/cobrancas/${id}`, d);
export const cancelarCobranca = (id: number, motivo: string) => apiPost<{ ok: boolean }>(`${FAT}/cobrancas/${id}/cancelar`, { motivo });
export const listarAuditoriaFaturamentoFinanceira = (f: { processoId?: number; entidade?: string; entidadeId?: number }) =>
  apiGet<AuditoriaFinanceira[]>(`${FAT}/auditoria-financeira${q(f)}`);

// ── Financeiro ──────────────────────────────────────────────────────────────
export const listarCobrancasFinanceiro = (f: { status?: string; vencidas?: boolean; busca?: string; empresaId?: number } = {}) => apiGet<Cobranca[]>(`${FIN}/cobrancas${q(f)}`);
export const listarRecebimentos = (f: { naoIdentificados?: boolean; situacao?: string; cobrancaId?: number; dataInicio?: string; dataFim?: string } = {}) =>
  apiGet<Recebimento[]>(`${FIN}/recebimentos${q(f)}`);
export const listarRetornos = () => apiGet<RetornoBancario[]>(`${FIN}/retornos`);
export const obterRetorno = (id: number) => apiGet<{ retorno: RetornoBancario; linhas: LinhaRetorno[] }>(`${FIN}/retornos/${id}`);
export const importarRetorno = (arquivo: { nomeArquivo: string; conteudoBase64: string }, bancoCodigo?: string) =>
  postComDetalhes<{ ok: boolean; id: number; resumo: RetornoBancario['resumo'] }>(`${FIN}/retornos`, { ...arquivo, bancoCodigo });
export const processarRetorno = (id: number) => apiPost<{ ok: boolean; recebimentos: number }>(`${FIN}/retornos/${id}/processar`, {});
export const descartarRetorno = (id: number, motivo: string) => apiPost<{ ok: boolean }>(`${FIN}/retornos/${id}/descartar`, { motivo });
export const registrarBaixaManual = (cobrancaId: number, d: Record<string, unknown>) => postComDetalhes<{ ok: boolean; status_cobranca: StatusCobranca }>(`${FIN}/cobrancas/${cobrancaId}/baixa-manual`, d);
export const vincularRecebimento = (id: number, d: { cobrancaId: number; motivo: string; confirmarValorMaior?: boolean }) => postComDetalhes<{ ok: boolean }>(`${FIN}/recebimentos/${id}/vincular`, d);
export const estornarRecebimento = (id: number, motivo: string) => apiPost<{ ok: boolean }>(`${FIN}/recebimentos/${id}/estornar`, { motivo });
export const listarAuditoriaFinanceiro = (f: { entidade?: string; entidadeId?: number; processoId?: number } = {}) => apiGet<AuditoriaFinanceira[]>(`${FIN}/auditoria${q(f)}`);

// ── Lançamentos de cooperados ───────────────────────────────────────────────
export type SituacaoLancamento = 'aguardando' | 'pendente' | 'reservado' | 'liquidado' | 'cancelado';
export interface Lancamento {
  id: number;
  candidato_id: number;
  cooperado_nome: string;
  matricula: string | null;
  tipo: 'credito' | 'debito';
  categoria: string;
  origem: string;
  origem_ref: string | null;
  competencia: string;
  compensar_a_partir: string | null;
  descricao: string;
  valor: string;
  situacao: SituacaoLancamento;
  pagamento_id: number | null;
  pagamento_codigo: string | null;
  motivo: string | null;
  criado_por_nome: string | null;
  criado_em: string;
  motivo_cancelamento: string | null;
}
export interface ItemPrevia {
  chave: string;
  fonte: string;
  candidato_id: number;
  nome: string;
  tipo: 'credito' | 'debito';
  categoria: string;
  descricao: string;
  valor: number | null;
  situacao: 'novo' | 'requer_confirmacao' | 'regra_pendente' | 'ja_lancado' | 'valor_diferente';
  observacao?: string;
}
export interface CooperadoBusca { id: number; nome: string; matricula: string | null; status: number }
export interface Bloqueio { id: number; candidato_id: number; cooperado_nome: string; motivo: string; ativo: number; criado_por_nome: string | null; criado_em: string; encerrado_por_nome: string | null; motivo_encerramento: string | null }

export const buscarCooperados = (busca: string) => apiGet<CooperadoBusca[]>(`${FIN}/cooperados${q({ busca })}`);
export const previaLancamentos = (competencia: string) => apiGet<{ competencia: string; itens: ItemPrevia[]; avisos: string[] }>(`${FIN}/lancamentos/previa${q({ competencia })}`);
export const gerarLancamentos = (competencia: string, chaves: string[]) => apiPost<{ ok: boolean; criados: number; recusados: { chave: string; motivo: string }[] }>(`${FIN}/lancamentos/gerar`, { competencia, chaves });
export const listarLancamentosCooperados = (f: { candidatoId?: number; competencia?: string; situacao?: string } = {}) => apiGet<Lancamento[]>(`${FIN}/lancamentos${q(f)}`);
export const criarLancamentoManual = (d: Record<string, unknown>) => postComDetalhes<{ ok: boolean; id: number }>(`${FIN}/lancamentos`, d);
export const cancelarLancamento = (id: number, motivo: string) => apiPost<{ ok: boolean }>(`${FIN}/lancamentos/${id}/cancelar`, { motivo });
export const estornarLancamento = (id: number, motivo: string, competencia?: string) => apiPost<{ ok: boolean }>(`${FIN}/lancamentos/${id}/estornar`, { motivo, competencia });
export const adiarCompensacao = (id: number, compensarAPartir: string, motivo: string) => apiPost<{ ok: boolean }>(`${FIN}/lancamentos/${id}/adiar`, { compensarAPartir, motivo });
export const registrarAdiantamento = (d: Record<string, unknown>) => apiPost<{ ok: boolean; id: number; codigo: string }>(`${FIN}/adiantamentos`, d);
export const listarBloqueios = (ativos = true) => apiGet<Bloqueio[]>(`${FIN}/bloqueios${q({ ativos })}`);
export const bloquearPagamentos = (candidatoId: number, motivo: string) => apiPost<{ ok: boolean }>(`${FIN}/bloqueios`, { candidatoId, motivo });
export const encerrarBloqueio = (id: number, motivo: string) => apiPost<{ ok: boolean }>(`${FIN}/bloqueios/${id}/encerrar`, { motivo });

// ── Fila de pagamentos e lotes ──────────────────────────────────────────────
export type SituacaoPagamento = 'em_preparacao' | 'liberado' | 'em_lote' | 'pago' | 'rejeitado' | 'retido' | 'cancelado';
export interface PendenciaPagamento { codigo: string; excepcionavel: boolean; descricao: string }
export interface PagamentoCooperado {
  id: number;
  codigo: string;
  candidato_id: number;
  cooperado_nome: string;
  matricula: string | null;
  status_cadastro: number;
  competencia: string;
  tipo: 'repasse' | 'adiantamento';
  valor_creditos: string;
  valor_debitos: string;
  valor_liquido: string;
  situacao: SituacaoPagamento;
  pendencias: PendenciaPagamento[];
  processos_vinculados: { id: number; codigo: string; cobrancas: string[] }[];
  recebimento_confirmado: number;
  excecao: number;
  excecao_motivo: string | null;
  excecao_por_nome: string | null;
  dados_bancarios: Record<string, string | null> | null;
  banco: string | null; codigo_banco: string | null; agencia: string | null; conta: string | null; digito: string | null; chave_pix: string | null; tipo_pix: string | null;
  liberado_por_nome: string | null;
  data_pagamento: string | null;
  confirmado_por_nome: string | null;
  motivo_situacao: string | null;
}
export interface DetalhePagamento {
  pagamento: PagamentoCooperado;
  lancamentos: Lancamento[];
  lotes: { id: number; lote_codigo: string; situacao: string; ocorrencia_codigo: string | null; ocorrencia_descricao: string | null }[];
  historico: AuditoriaFinanceira[];
}
export interface LotePagamento {
  id: number; codigo: string; banco_codigo: string | null; modalidade: 'credito_conta' | 'ted' | 'pix'; leiaute: string; situacao: string; documento_id: number | null; sha256: string | null;
  total_itens: number; valor_total: string; gerado_por_nome: string | null; gerado_em: string; enviado_por_nome: string | null; enviado_em: string | null; motivo_cancelamento: string | null;
  itens_pendentes?: string; itens_confirmados?: string; itens_rejeitados?: string;
}
export interface ItemLote { id: number; pagamento_id: number; pagamento_codigo: string; cooperado_nome: string; valor: string; favorecido: Record<string, string | null>; situacao: string; ocorrencia_codigo: string | null; ocorrencia_descricao: string | null }

export const montarFilaPagamentos = (competencia: string) => apiPost<{ ok: boolean; criados: number; atualizados: number; avisos: string[] }>(`${FIN}/pagamentos/montar`, { competencia });
export const atualizarPendenciasFila = (competencia?: string) => apiPost<{ ok: boolean; atualizados: number }>(`${FIN}/pagamentos/atualizar-pendencias`, { competencia });
export const listarFilaPagamentos = (f: { competencia?: string; situacao?: string; tipo?: string } = {}) => apiGet<PagamentoCooperado[]>(`${FIN}/pagamentos${q(f)}`);
export const obterPagamentoCooperado = (id: number) => apiGet<DetalhePagamento>(`${FIN}/pagamentos/${id}`);
export const liberarPagamentoCooperado = (id: number, d: { excecao?: boolean; motivo?: string } = {}) => postComDetalhes<{ ok: boolean; excecao: boolean }>(`${FIN}/pagamentos/${id}/liberar`, d);
export const desfazerLiberacao = (id: number, motivo: string) => apiPost<{ ok: boolean }>(`${FIN}/pagamentos/${id}/desfazer-liberacao`, { motivo });
export const cancelarPagamentoCooperado = (id: number, motivo: string) => apiPost<{ ok: boolean }>(`${FIN}/pagamentos/${id}/cancelar`, { motivo });
export const confirmarPagamentoCooperado = (id: number, d: Record<string, unknown>) => apiPost<{ ok: boolean }>(`${FIN}/pagamentos/${id}/confirmar`, d);
export const listarLotesPagamento = () => apiGet<LotePagamento[]>(`${FIN}/lotes`);
export const criarLotePagamento = (d: { modalidade: string; bancoCodigo?: string; pagamentoIds: number[] }) => postComDetalhes<{ ok: boolean; id: number; codigo: string; leiaute: string; aviso: string | null }>(`${FIN}/lotes`, d);
export const obterLotePagamento = (id: number) => apiGet<{ lote: LotePagamento; itens: ItemLote[] }>(`${FIN}/lotes/${id}`);
export const marcarLoteEnviado = (id: number) => apiPost<{ ok: boolean }>(`${FIN}/lotes/${id}/enviado`, {});
export const cancelarLotePagamento = (id: number, motivo: string) => apiPost<{ ok: boolean }>(`${FIN}/lotes/${id}/cancelar`, { motivo });
export const registrarOcorrenciaLote = (itemId: number, d: Record<string, unknown>) => apiPost<{ ok: boolean }>(`${FIN}/lotes/itens/${itemId}/ocorrencia`, d);

// ── Contas a pagar ──────────────────────────────────────────────────────────
export interface Fornecedor {
  id: number; nome: string; documento: string; email: string | null; telefone: string | null; codigo_banco: string | null; agencia: string | null; conta: string | null;
  digito: string | null; tipo_conta: string | null; chave_pix: string | null; tipo_pix: string | null; ativo: number; observacao: string | null;
}
export interface CategoriaConta { id: number; nome: string; ativa: number }
export type SituacaoConta = 'aguardando_aprovacao' | 'aprovada' | 'programada' | 'paga' | 'rejeitada' | 'cancelada';
export interface ContaPagar {
  id: number; codigo: string; fornecedor_id: number; fornecedor_nome: string; categoria_id: number; categoria_nome: string; descricao: string; competencia: string; valor: string;
  vencimento: string; documento_tipo: string; documento_numero: string | null; documento_emissao: string | null; situacao: SituacaoConta; forma_pagamento: string | null;
  data_programada: string | null; data_pagamento: string | null; valor_pago: string | null; juros: string; multa: string; desconto: string; observacao: string | null;
  motivo_situacao: string | null; criado_por_nome: string | null; aprovado_por_nome: string | null; programado_por_nome: string | null; baixado_por_nome: string | null; vencida: number;
}
export const listarFornecedores = (f: { busca?: string; incluirInativos?: boolean } = {}) => apiGet<Fornecedor[]>(`${FIN}/fornecedores${q(f)}`);
export const salvarFornecedor = (id: number | null, d: Record<string, unknown>) => (id ? apiPut<{ ok: boolean }>(`${FIN}/fornecedores/${id}`, d) : apiPost<{ ok: boolean; id: number }>(`${FIN}/fornecedores`, d));
export const listarCategoriasContas = (incluirInativas = false) => apiGet<CategoriaConta[]>(`${FIN}/categorias-contas${q({ incluirInativas })}`);
export const salvarCategoriaConta = (id: number | null, d: Record<string, unknown>) => (id ? apiPut<{ ok: boolean }>(`${FIN}/categorias-contas/${id}`, d) : apiPost<{ ok: boolean; id: number }>(`${FIN}/categorias-contas`, d));
export const listarContasPagar = (f: { situacao?: string; vencidas?: boolean; competencia?: string; fornecedorId?: number } = {}) => apiGet<ContaPagar[]>(`${FIN}/contas-pagar${q(f)}`);
export const obterContaPagar = (id: number) => apiGet<{ conta: ContaPagar; anexos: DocumentoFinanceiro[]; historico: AuditoriaFinanceira[] }>(`${FIN}/contas-pagar/${id}`);
export const criarContaPagar = (d: Record<string, unknown>) => apiPost<{ ok: boolean; id: number; codigo: string }>(`${FIN}/contas-pagar`, d);
export const atualizarContaPagar = (id: number, d: Record<string, unknown>) => apiPut<{ ok: boolean }>(`${FIN}/contas-pagar/${id}`, d);
export const aprovarContaPagar = (id: number) => apiPost<{ ok: boolean }>(`${FIN}/contas-pagar/${id}/aprovar`, {});
export const rejeitarContaPagar = (id: number, motivo: string) => apiPost<{ ok: boolean }>(`${FIN}/contas-pagar/${id}/rejeitar`, { motivo });
export const programarContaPagar = (id: number, d: Record<string, unknown>) => apiPost<{ ok: boolean; aviso: string | null }>(`${FIN}/contas-pagar/${id}/programar`, d);
export const baixarContaPagar = (id: number, d: Record<string, unknown>) => apiPost<{ ok: boolean }>(`${FIN}/contas-pagar/${id}/baixar`, d);
export const estornarBaixaContaPagar = (id: number, motivo: string) => apiPost<{ ok: boolean }>(`${FIN}/contas-pagar/${id}/estornar-baixa`, { motivo });
export const cancelarContaPagar = (id: number, motivo: string) => apiPost<{ ok: boolean }>(`${FIN}/contas-pagar/${id}/cancelar`, { motivo });
export const anexarDocumentoContaPagar = (id: number, tipo: string, arquivo: { nomeArquivo: string; conteudoBase64: string }) => apiPost<{ ok: boolean }>(`${FIN}/contas-pagar/${id}/anexos`, { tipo, ...arquivo });

// ── Relatórios ──────────────────────────────────────────────────────────────
export type TipoColunaRelatorio = 'texto' | 'moeda' | 'numero' | 'data' | 'competencia';
export interface SecaoRelatorio {
  titulo: string;
  colunas: { chave: string; titulo: string; tipo: TipoColunaRelatorio }[];
  linhas: Record<string, string | number | null>[];
  totais?: Record<string, number>;
}
export interface Relatorio {
  tipo: string;
  titulo: string;
  gerado_em: string;
  filtros: Record<string, string | number | null>;
  resumo: { rotulo: string; valor: number; tipo: TipoColunaRelatorio }[];
  divergencias: { nivel: 'erro' | 'atencao'; texto: string; referencia: string }[];
  secoes: SecaoRelatorio[];
  avisos: string[];
}
export const listarRelatoriosDisponiveis = () => apiGet<{ tipo: string; titulo: string }[]>(`${FIN}/relatorios`);
export const obterOpcoesRelatorios = () => apiGet<{ empresas: { id: number; nome_empresa: string }[]; categorias: { id: number; nome: string }[] }>(`${FIN}/relatorios-opcoes`);
export const gerarRelatorio = (tipo: string, filtros: Record<string, unknown>) => apiGet<Relatorio>(`${FIN}/relatorios/${tipo}${q(filtros)}`);
