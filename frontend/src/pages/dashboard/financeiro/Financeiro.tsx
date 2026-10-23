import React, { useEffect, useRef, useState } from 'react';
import '../monitoramento/Monitoramento.css';
import { useToast } from '../../../components/ToastContext';
import { useAuth } from '../../../auth/AuthContext';
import { usePermissoes } from '../../../auth/PermissoesContext';
import { calcularAcessoFinanceiro } from '../../../auth/acessoFinanceiro';
import { formatarDataBR, formatarMoeda } from '../../../utils/formatters';
import {
  AuditoriaFinanceira, ClassificacaoPagamento, Cobranca, ErroComDetalhes, LinhaRetorno, Recebimento, RetornoBancario,
  baixarDocumentoFinanceiro, baixarModeloRetornoCsv, descartarRetorno, estornarRecebimento, importarRetorno, lerArquivoBase64,
  listarAuditoriaFinanceiro, listarCobrancasFinanceiro, listarRecebimentos, listarRetornos, obterRetorno, processarRetorno,
  registrarBaixaManual, vincularRecebimento,
} from '../../../api/financeiroApi';
import ModalFormulario from './ModalFormulario';
import LancamentosCooperados from './LancamentosCooperados';
import FilaPagamentos from './FilaPagamentos';
import ContasPagar from './ContasPagar';

type Aba = 'cobrancas' | 'retornos' | 'recebimentos' | 'lancamentos' | 'pagamentos' | 'contas' | 'auditoria';
const ABAS: [Aba, string, string][] = [
  ['cobrancas', 'Cobranças', 'financeiro.recebimentos'],
  ['retornos', 'Retorno bancário', 'financeiro.recebimentos'],
  ['recebimentos', 'Recebimentos', 'financeiro.recebimentos'],
  ['lancamentos', 'Lançamentos de cooperados', 'financeiro.lancamentos'],
  ['pagamentos', 'Pagamentos de cooperados', 'financeiro.pagamentos'],
  ['contas', 'Contas a pagar', 'financeiro.contas_pagar'],
  ['auditoria', 'Auditoria', 'financeiro.recebimentos'],
];

const ROTULO_CLASSIFICACAO: Record<ClassificacaoPagamento, string> = {
  integral: 'Integral',
  parcial: 'Parcial',
  a_maior: 'Valor a maior (divergente)',
  nao_identificado: 'Não identificado',
  cobranca_cancelada: 'Cobrança cancelada',
  ja_quitada: 'Cobrança já quitada',
  duplicado: 'Duplicado (ignorado)',
};
const CLASSE_CLASSIFICACAO: Record<ClassificacaoPagamento, string> = {
  integral: 'badge-em-atividade', parcial: 'badge-pendente', a_maior: 'badge-divergente', nao_identificado: 'badge-divergente',
  cobranca_cancelada: 'badge-divergente', ja_quitada: 'badge-divergente', duplicado: 'badge-inativo',
};
const ROTULO_COBRANCA: Record<string, [string, string]> = {
  aberta: ['Aberta', 'badge-ativo'], parcial: ['Paga parcialmente', 'badge-pendente'], paga: ['Paga', 'badge-em-atividade'],
  divergente: ['Recebido a maior', 'badge-divergente'], cancelada: ['Cancelada', 'badge-inativo'],
};
const moeda = (v: string | number | null | undefined) => (v === null || v === undefined ? '—' : formatarMoeda(Number(v)));
const dataHora = (s: string | null) => (s ? new Date(s.replace(' ', 'T')).toLocaleString('pt-BR') : '—');
const Badge: React.FC<{ classe: string; rotulo: string }> = ({ classe, rotulo }) => (
  <span className={`badge-status ${classe}`}><span className="badge-status-dot" />{rotulo}</span>
);

export const Financeiro: React.FC = () => {
  const { showToast } = useToast();
  const { usuario } = useAuth();
  const { permissoes } = usePermissoes();
  const podeBaixaManual = calcularAcessoFinanceiro(usuario?.perfil, permissoes, 'financeiro.baixa_manual');
  const abasVisiveis = ABAS.filter(([, , item]) => calcularAcessoFinanceiro(usuario?.perfil, permissoes, item));
  const [aba, setAba] = useState<Aba>(abasVisiveis[0]?.[0] ?? 'cobrancas');
  const [modal, setModal] = useState<React.ComponentProps<typeof ModalFormulario> | null>(null);
  const [ocupado, setOcupado] = useState(false);

  // Cobranças
  const [filtroCob, setFiltroCob] = useState<'abertas' | 'vencidas' | 'divergentes' | 'todas'>('abertas');
  const [busca, setBusca] = useState('');
  const [cobrancas, setCobrancas] = useState<Cobranca[]>([]);
  // Retornos
  const [retornos, setRetornos] = useState<RetornoBancario[]>([]);
  const [retornoAberto, setRetornoAberto] = useState<{ retorno: RetornoBancario; linhas: LinhaRetorno[] } | null>(null);
  const [bancoImportacao, setBancoImportacao] = useState('');
  const [errosImportacao, setErrosImportacao] = useState<{ mensagem: string; detalhes: string[] } | null>(null);
  const inputArquivo = useRef<HTMLInputElement>(null);
  // Recebimentos
  const [soNaoIdentificados, setSoNaoIdentificados] = useState(true);
  const [recebimentos, setRecebimentos] = useState<Recebimento[]>([]);
  // Auditoria
  const [auditoria, setAuditoria] = useState<AuditoriaFinanceira[]>([]);

  const carregarCobrancas = async () => {
    const f = { abertas: { status: 'aberta,parcial' }, vencidas: { vencidas: true }, divergentes: { status: 'divergente' }, todas: {} }[filtroCob];
    try { setCobrancas(await listarCobrancasFinanceiro({ ...f, busca: busca || undefined })); }
    catch (err: any) { showToast(err?.message || 'Erro ao listar cobranças.', 'error'); }
  };
  const carregarRetornos = async () => {
    try { setRetornos(await listarRetornos()); } catch (err: any) { showToast(err?.message || 'Erro ao listar retornos.', 'error'); }
  };
  const carregarRecebimentos = async () => {
    try { setRecebimentos(await listarRecebimentos(soNaoIdentificados ? { naoIdentificados: true } : {})); }
    catch (err: any) { showToast(err?.message || 'Erro ao listar recebimentos.', 'error'); }
  };

  useEffect(() => { if (aba === 'cobrancas') carregarCobrancas(); }, [aba, filtroCob]);
  useEffect(() => { if (aba === 'retornos') carregarRetornos(); }, [aba]);
  useEffect(() => { if (aba === 'recebimentos') carregarRecebimentos(); }, [aba, soNaoIdentificados]);
  useEffect(() => { if (aba === 'auditoria') listarAuditoriaFinanceiro().then(setAuditoria).catch((e) => showToast(e?.message || 'Erro.', 'error')); }, [aba]);

  const executar = async (acao: () => Promise<unknown>, sucesso: string, depois: () => Promise<unknown>) => {
    setOcupado(true);
    try { await acao(); showToast(sucesso, 'success'); await depois(); }
    catch (err: any) { showToast(err?.message || 'Não foi possível concluir a ação.', 'error'); }
    finally { setOcupado(false); }
  };

  /** Chama a ação; se o servidor pedir confirmação de valor acima do saldo, pergunta e repete. */
  const comConfirmacaoValorMaior = async (acao: (confirmar: boolean) => Promise<unknown>) => {
    try { await acao(false); }
    catch (err) {
      const e = err as ErroComDetalhes;
      if (e.codigo !== 'VALOR_MAIOR_QUE_SALDO' || !window.confirm(`${e.message}\n\nRegistrar mesmo assim? A cobrança ficará como "Recebido a maior" para análise.`)) throw e;
      await acao(true);
    }
  };

  const abrirBaixaManual = (c: Cobranca) => setModal({
    titulo: `Baixa manual — ${c.codigo}`,
    descricao: <>Cliente {c.nome_empresa} · valor {moeda(c.valor)} · já recebido {moeda(c.valor_recebido)} · <strong>saldo {moeda(c.saldo)}</strong>. A baixa manual fica registrada em seu nome como autorização.</>,
    campos: [
      { nome: 'valor', rotulo: 'Valor recebido', tipo: 'numero', obrigatorio: true, largura: 'metade' },
      { nome: 'dataPagamento', rotulo: 'Data do pagamento', tipo: 'data', obrigatorio: true, largura: 'metade' },
      { nome: 'dataCredito', rotulo: 'Data do crédito', tipo: 'data', largura: 'metade' },
      { nome: 'pagadorNome', rotulo: 'Pagador', largura: 'metade' },
      { nome: 'motivo', rotulo: 'Motivo / evidência (ex.: TED identificada no extrato)', tipo: 'textarea', obrigatorio: true },
      { nome: 'comprovante', rotulo: 'Comprovante (PDF/imagem, opcional)', tipo: 'arquivo', aceitar: '.pdf,.png,.jpg,.jpeg' },
    ],
    valoresIniciais: { valor: String(Number(c.saldo)).replace('.', ',') },
    onConfirmar: async (v) => {
      await comConfirmacaoValorMaior((confirmarValorMaior) => registrarBaixaManual(c.id, { ...v, comprovante: v.comprovante || undefined, confirmarValorMaior }));
      showToast('Baixa manual registrada.', 'success');
      await carregarCobrancas();
    },
    onClose: () => setModal(null),
  });

  const abrirVinculo = async (r: Recebimento) => {
    let abertas: Cobranca[] = [];
    try { abertas = await listarCobrancasFinanceiro({ status: 'aberta,parcial' }); } catch { /* lista vazia */ }
    setModal({
      titulo: `Vincular recebimento de ${moeda(r.valor)}`,
      descricao: <>Identificador "{r.identificador ?? '—'}", pago em {formatarDataBR(r.data_pagamento)}{r.pagador_nome ? ` por ${r.pagador_nome}` : ''}. {r.observacao}</>,
      campos: [
        { nome: 'cobrancaId', rotulo: 'Cobrança', tipo: 'select', obrigatorio: true, opcoes: abertas.map((c) => ({ valor: c.id, rotulo: `${c.codigo} · ${c.nome_empresa} · saldo ${moeda(c.saldo)} · venc. ${formatarDataBR(c.vencimento)}` })) },
        { nome: 'motivo', rotulo: 'Motivo / evidência do vínculo', tipo: 'textarea', obrigatorio: true },
      ],
      valoresIniciais: { cobrancaId: abertas[0]?.id ?? '' },
      onConfirmar: async (v) => {
        await comConfirmacaoValorMaior((confirmarValorMaior) => vincularRecebimento(r.id, { cobrancaId: Number(v.cobrancaId), motivo: v.motivo, confirmarValorMaior }));
        showToast('Recebimento vinculado.', 'success');
        await carregarRecebimentos();
      },
      onClose: () => setModal(null),
    });
  };

  const pedirMotivo = (titulo: string, acao: (m: string) => Promise<unknown>, sucesso: string, depois: () => Promise<unknown>, descricao?: string) => setModal({
    titulo, descricao, campos: [{ nome: 'motivo', rotulo: 'Motivo', tipo: 'textarea', obrigatorio: true }],
    onConfirmar: async (v) => { await acao(v.motivo); showToast(sucesso, 'success'); await depois(); },
    onClose: () => setModal(null),
  });

  const handleArquivoRetorno = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const arq = e.target.files?.[0];
    e.target.value = '';
    if (!arq) return;
    setErrosImportacao(null);
    setOcupado(true);
    try {
      const r = await importarRetorno(await lerArquivoBase64(arq), bancoImportacao || undefined);
      showToast('Arquivo validado. Confira a prévia e processe.', 'success');
      await carregarRetornos();
      setRetornoAberto(await obterRetorno(r.id));
    } catch (err) {
      const e2 = err as ErroComDetalhes;
      setErrosImportacao({ mensagem: e2.message, detalhes: e2.detalhes ?? [] });
    } finally {
      setOcupado(false);
    }
  };

  const abrirRetorno = async (id: number) => {
    if (retornoAberto?.retorno.id === id) { setRetornoAberto(null); return; }
    try { setRetornoAberto(await obterRetorno(id)); } catch (err: any) { showToast(err?.message || 'Erro ao abrir retorno.', 'error'); }
  };

  const resumoTexto = (r: RetornoBancario) => Object.entries(r.resumo).map(([k, v]) => `${ROTULO_CLASSIFICACAO[k as ClassificacaoPagamento] ?? k}: ${v!.quantidade} (${moeda(v!.valor)})`).join(' · ');

  return (
    <div className="monitoramento-container">
      <div className="monitoramento-header">
        <div className="monitoramento-title-group">
          <h1>Financeiro</h1>
          <p>Recebimentos e retorno bancário, lançamentos e pagamentos dos cooperados, lotes de pagamento e contas a pagar.</p>
        </div>
      </div>

      <div className="monitoramento-tabs-nav">
        {abasVisiveis.map(([id, rotulo]) => (
          <button key={id} type="button" className={`monitoramento-tab-btn ${aba === id ? 'active' : ''}`} onClick={() => setAba(id)}>{rotulo}</button>
        ))}
      </div>

      {aba === 'cobrancas' && (
        <div className="monitoramento-table-card">
          <div className="table-card-header">
            <h3 className="table-card-title">Cobranças</h3>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <select className="filter-select" value={filtroCob} onChange={(e) => setFiltroCob(e.target.value as typeof filtroCob)}>
                <option value="abertas">Em aberto / parciais</option>
                <option value="vencidas">Vencidas</option>
                <option value="divergentes">Recebidas a maior</option>
                <option value="todas">Todas</option>
              </select>
              <input className="filter-input" placeholder="Código, nosso número, cliente, nº NF" value={busca} onChange={(e) => setBusca(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && carregarCobrancas()} />
              <button type="button" className="btn-secondary-filter" onClick={carregarCobrancas}>Buscar</button>
            </div>
          </div>
          <div className="table-responsive">
            <table className="monitoramento-table" style={{ fontSize: 12 }}>
              <thead><tr><th>Código</th><th>Cliente</th><th>Processo</th><th>NF</th><th>Vencimento</th><th>Nosso número</th><th style={{ textAlign: 'right' }}>Valor</th><th style={{ textAlign: 'right' }}>Recebido</th><th style={{ textAlign: 'right' }}>Saldo</th><th>Status</th><th /></tr></thead>
              <tbody>
                {cobrancas.length === 0 ? (
                  <tr><td colSpan={11} style={{ textAlign: 'center', padding: 24, color: '#94a3b8' }}>Nenhuma cobrança.</td></tr>
                ) : cobrancas.map((c) => (
                  <tr key={c.id}>
                    <td><strong>{c.codigo}</strong></td>
                    <td>{c.nome_empresa}</td>
                    <td>{c.processo_codigo}</td>
                    <td>{c.nota_numero ?? '—'}</td>
                    <td style={{ color: c.vencida ? '#b91c1c' : undefined }}>{formatarDataBR(c.vencimento)}{c.vencida ? ' (vencida)' : ''}</td>
                    <td>{c.nosso_numero ? `${c.banco_codigo ?? ''} ${c.nosso_numero}` : '—'}</td>
                    <td style={{ textAlign: 'right' }}>{moeda(c.valor)}</td>
                    <td style={{ textAlign: 'right' }}>{moeda(c.valor_recebido)}</td>
                    <td style={{ textAlign: 'right' }}>{moeda(c.saldo)}</td>
                    <td><Badge classe={ROTULO_COBRANCA[c.status][1]} rotulo={ROTULO_COBRANCA[c.status][0]} /></td>
                    <td>{podeBaixaManual && ['aberta', 'parcial'].includes(c.status) && (
                      <button type="button" className="btn-action-view" disabled={ocupado} onClick={() => abrirBaixaManual(c)}>Baixa manual</button>
                    )}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {aba === 'retornos' && (
        <div className="monitoramento-table-card">
          <div className="table-card-header">
            <div>
              <h3 className="table-card-title">Retorno bancário</h3>
              <p style={{ margin: '4px 0 0 0', fontSize: 13, color: '#64748b' }}>
                Arquivos CNAB 240/400 têm a estrutura validada (header, trailer, banco, arquivo de retorno). A leitura dos pagamentos de cada banco é
                habilitada quando a ATESA enviar o leiaute oficial do banco. Enquanto isso, use a planilha padrão (CSV).
                O mesmo arquivo não pode ser processado duas vezes.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <input className="filter-input" style={{ width: 120 }} placeholder="Banco (ex.: 341)" value={bancoImportacao} onChange={(e) => setBancoImportacao(e.target.value.replace(/\D/g, '').slice(0, 3))} title="Banco do nosso número para a planilha CSV" />
              <button type="button" className="btn-secondary-filter" onClick={() => baixarModeloRetornoCsv().catch((e) => showToast(e?.message || 'Erro.', 'error'))}>⬇ Planilha modelo</button>
              <button type="button" className="btn-primary-filter" disabled={ocupado} onClick={() => inputArquivo.current?.click()}>{ocupado ? 'Validando...' : '⬆ Importar arquivo'}</button>
              <input ref={inputArquivo} type="file" accept=".ret,.txt,.csv,.rem" style={{ display: 'none' }} onChange={handleArquivoRetorno} />
            </div>
          </div>
          {errosImportacao && (
            <div style={{ padding: '12px 24px', background: '#fef2f2', color: '#991b1b', fontSize: 13 }}>
              <strong>{errosImportacao.mensagem}</strong>
              {errosImportacao.detalhes.length > 0 && <ul style={{ margin: '6px 0 0 18px' }}>{errosImportacao.detalhes.map((d, i) => <li key={i}>{d}</li>)}</ul>}
            </div>
          )}
          <div className="table-responsive">
            <table className="monitoramento-table" style={{ fontSize: 12 }}>
              <thead><tr><th>#</th><th>Arquivo</th><th>Leiaute</th><th>Importado</th><th style={{ textAlign: 'right' }}>Registros</th><th style={{ textAlign: 'right' }}>Total</th><th>Resumo</th><th>Status</th><th /></tr></thead>
              <tbody>
                {retornos.length === 0 ? (
                  <tr><td colSpan={9} style={{ textAlign: 'center', padding: 24, color: '#94a3b8' }}>Nenhum arquivo importado.</td></tr>
                ) : retornos.map((r) => (
                  <React.Fragment key={r.id}>
                    <tr style={{ cursor: 'pointer', background: retornoAberto?.retorno.id === r.id ? '#f0fdf4' : undefined }} onClick={() => abrirRetorno(r.id)}>
                      <td>{r.id}</td>
                      <td>{r.nome_arquivo}{r.documento_id && (
                        <button type="button" style={{ marginLeft: 6, border: 'none', background: 'none', color: '#2563eb', cursor: 'pointer' }}
                          onClick={(e) => { e.stopPropagation(); baixarDocumentoFinanceiro(r.documento_id!, r.nome_arquivo).catch((x) => showToast(x?.message || 'Erro.', 'error')); }}>⬇</button>
                      )}</td>
                      <td>{r.layout.toUpperCase()}{r.banco_codigo ? ` · ${r.banco_codigo}` : ''}</td>
                      <td>{dataHora(r.importado_em)}<div style={{ color: '#64748b' }}>{r.importado_por_nome}</div></td>
                      <td style={{ textAlign: 'right' }}>{r.total_registros}</td>
                      <td style={{ textAlign: 'right' }}>{moeda(r.valor_total)}</td>
                      <td style={{ maxWidth: 320 }}>{resumoTexto(r)}</td>
                      <td>{{ pendente: 'Aguardando processamento', processado: `Processado (${r.processado_por_nome ?? ''})`, descartado: `Descartado: ${r.motivo_descarte ?? ''}` }[r.status]}</td>
                      <td style={{ whiteSpace: 'nowrap' }} onClick={(e) => e.stopPropagation()}>
                        {r.status === 'pendente' && (
                          <>
                            <button type="button" className="btn-action-view" disabled={ocupado} onClick={() => window.confirm('Processar o arquivo? Os pagamentos identificados serão baixados nas cobranças.') && executar(() => processarRetorno(r.id), 'Retorno processado.', async () => { await carregarRetornos(); setRetornoAberto(await obterRetorno(r.id)); })}>Processar</button>{' '}
                            <button type="button" className="btn-action-obs" disabled={ocupado} onClick={() => pedirMotivo('Descartar arquivo', (m) => descartarRetorno(r.id, m), 'Arquivo descartado.', carregarRetornos, 'Nenhuma baixa é feita; o arquivo poderá ser importado novamente.')}>Descartar</button>
                          </>
                        )}
                      </td>
                    </tr>
                    {retornoAberto?.retorno.id === r.id && (
                      <tr><td colSpan={9} style={{ background: '#f8fafc', padding: 0 }}>
                        <table className="monitoramento-table" style={{ fontSize: 12, margin: 0 }}>
                          <thead><tr><th>Linha</th><th>Identificador</th><th>Pagamento</th><th>Pagador</th><th style={{ textAlign: 'right' }}>Valor</th><th>Cobrança</th><th>Classificação</th></tr></thead>
                          <tbody>
                            {retornoAberto.linhas.map((l) => (
                              <tr key={l.id}>
                                <td>{l.linha_numero}</td>
                                <td>{l.identificador}</td>
                                <td>{formatarDataBR(l.data_pagamento)}</td>
                                <td>{l.pagador_nome ?? '—'}</td>
                                <td style={{ textAlign: 'right' }}>{moeda(l.valor_pago)}</td>
                                <td>{l.cobranca_codigo ? `${l.cobranca_codigo} · ${l.nome_empresa}` : '—'}</td>
                                <td><Badge classe={CLASSE_CLASSIFICACAO[l.classificacao]} rotulo={ROTULO_CLASSIFICACAO[l.classificacao]} />{l.mensagem && <div style={{ color: '#64748b' }}>{l.mensagem}</div>}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </td></tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {aba === 'recebimentos' && (
        <div className="monitoramento-table-card">
          <div className="table-card-header">
            <h3 className="table-card-title">Recebimentos</h3>
            <label style={{ fontSize: 13, display: 'flex', gap: 6, alignItems: 'center' }}>
              <input type="checkbox" checked={soNaoIdentificados} onChange={(e) => setSoNaoIdentificados(e.target.checked)} /> Somente não identificados
            </label>
          </div>
          <div className="table-responsive">
            <table className="monitoramento-table" style={{ fontSize: 12 }}>
              <thead><tr><th>Pagamento</th><th>Identificador</th><th>Pagador</th><th style={{ textAlign: 'right' }}>Valor</th><th>Cobrança</th><th>Origem</th><th>Situação</th><th /></tr></thead>
              <tbody>
                {recebimentos.length === 0 ? (
                  <tr><td colSpan={8} style={{ textAlign: 'center', padding: 24, color: '#94a3b8' }}>Nenhum recebimento{soNaoIdentificados ? ' não identificado' : ''}.</td></tr>
                ) : recebimentos.map((r) => (
                  <tr key={r.id} style={{ opacity: r.situacao === 'estornado' ? 0.55 : 1 }}>
                    <td>{formatarDataBR(r.data_pagamento)}</td>
                    <td>{r.identificador ?? '—'}</td>
                    <td>{r.pagador_nome ?? '—'}</td>
                    <td style={{ textAlign: 'right' }}>{moeda(r.valor)}</td>
                    <td>{r.cobranca_codigo ? `${r.cobranca_codigo} · ${r.nome_empresa}` : <span style={{ color: '#b91c1c' }}>Não identificado{r.observacao ? ` — ${r.observacao}` : ''}</span>}</td>
                    <td>{r.origem === 'manual' ? `Baixa manual (${r.autorizado_por_nome ?? '—'})` : 'Retorno bancário'}{r.motivo && <div style={{ color: '#64748b' }}>{r.motivo}</div>}</td>
                    <td>{r.situacao === 'estornado' ? `Estornado: ${r.motivo_estorno ?? ''}` : 'Ativo'}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {podeBaixaManual && r.situacao === 'ativo' && !r.cobranca_id && <button type="button" className="btn-action-view" disabled={ocupado} onClick={() => abrirVinculo(r)}>Vincular</button>}{' '}
                      {podeBaixaManual && r.situacao === 'ativo' && <button type="button" className="btn-action-obs" disabled={ocupado} onClick={() => pedirMotivo('Estornar recebimento', (m) => estornarRecebimento(r.id, m), 'Recebimento estornado.', carregarRecebimentos, 'A cobrança vinculada volta a ter saldo em aberto.')}>Estornar</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {aba === 'lancamentos' && <LancamentosCooperados />}
      {aba === 'pagamentos' && <FilaPagamentos podeExcecao={calcularAcessoFinanceiro(usuario?.perfil, permissoes, 'financeiro.excecao_pagamento')} />}
      {aba === 'contas' && <ContasPagar podeAprovar={calcularAcessoFinanceiro(usuario?.perfil, permissoes, 'financeiro.contas_aprovar')} />}

      {aba === 'auditoria' && (
        <div className="monitoramento-table-card">
          <div className="table-card-header"><h3 className="table-card-title">Auditoria financeira (últimas 500 operações)</h3></div>
          <div className="table-responsive">
            <table className="monitoramento-table" style={{ fontSize: 12 }}>
              <thead><tr><th>Data</th><th>Usuário</th><th>Entidade</th><th>Ação</th><th>De</th><th>Para</th><th>Motivo</th></tr></thead>
              <tbody>
                {auditoria.map((a) => (
                  <tr key={a.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>{dataHora(a.criado_em)}</td>
                    <td>{a.usuario_nome ?? '—'}{a.usuario_perfil && <span style={{ color: '#64748b' }}> ({a.usuario_perfil})</span>}</td>
                    <td>{a.entidade}{a.entidade_id ? ` #${a.entidade_id}` : ''}</td>
                    <td>{a.acao}{a.campo ? ` · ${a.campo}` : ''}</td>
                    <td style={{ maxWidth: 220, wordBreak: 'break-word' }}>{a.valor_anterior ?? '—'}</td>
                    <td style={{ maxWidth: 260, wordBreak: 'break-word' }}>{a.valor_novo ?? '—'}</td>
                    <td style={{ maxWidth: 220 }}>{a.motivo ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {modal && <ModalFormulario {...modal} />}
    </div>
  );
};

export default Financeiro;
