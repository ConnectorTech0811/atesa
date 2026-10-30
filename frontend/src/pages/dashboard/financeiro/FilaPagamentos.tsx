import React, { useEffect, useState } from 'react';
import '../monitoramento/Monitoramento.css';
import { useToast } from '../../../components/ToastContext';
import { dataLocalISO, formatarDataBR, formatarMoeda } from '../../../utils/formatters';
import {
  DetalhePagamento, ErroComDetalhes, ItemLote, LotePagamento, PagamentoCooperado, PendenciaPagamento, adiarCompensacao, atualizarPendenciasFila, baixarDocumentoFinanceiro,
  cancelarLotePagamento, cancelarPagamentoCooperado, confirmarPagamentoCooperado, confirmarPagamentosCooperados, criarLotePagamento, desfazerLiberacao, liberarPagamentoCooperado,
  listarFilaPagamentos, listarLotesPagamento, marcarLoteEnviado, montarFilaPagamentos, obterLotePagamento, obterPagamentoCooperado, registrarOcorrenciaLote,
  salvarDadosBancariosCooperado, solicitarDadosBancarios,
} from '../../../api/financeiroApi';
import ModalFormulario, { ValoresFormulario } from './ModalFormulario';
import { camposBancarios, soDigitos } from './camposBancarios';

const competenciaAnterior = (() => {
  const [a, m] = dataLocalISO().split('-').map(Number);
  const d = new Date(a, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
})();
const SITUACAO: Record<string, [string, string]> = {
  em_preparacao: ['Em preparação', 'badge-pendente'], liberado: ['Liberado', 'badge-ativo'], em_lote: ['Em lote (aguardando banco)', 'badge-ativo'],
  pago: ['✓ Pago', 'badge-em-atividade'], rejeitado: ['Rejeitado pelo banco', 'badge-divergente'], retido: ['Retido', 'badge-divergente'], cancelado: ['Cancelado', 'badge-inativo'],
};
const MODALIDADES = [{ valor: 'credito_conta', rotulo: 'Crédito em conta (mesmo banco)' }, { valor: 'ted', rotulo: 'TED' }, { valor: 'pix', rotulo: 'PIX' }];
const SITUACOES_ABERTAS = ['em_preparacao', 'retido', 'rejeitado'];
const PENDENCIAS_BANCARIAS = ['sem_dados_bancarios', 'dados_bancarios_invalidos'];
/** Onde cada pendência se resolve. `aba`: aba do Financeiro com o caminho direto. */
const CAMINHO_PENDENCIA: Record<string, { como: string; aba?: [string, string] }> = {
  sem_dados_bancarios: { como: 'Se você já tem os dados, cadastre aqui. Se não tem, envie a solicitação: o setor de Benefícios recebe o alerta e coleta com o cooperado.' },
  dados_bancarios_invalidos: { como: 'Corrija aqui ou envie a solicitação para o setor de Benefícios conferir com o cooperado.' },
  liquido_nao_positivo: { como: 'Abra o pagamento pelo código, na lista, e use "Adiar" em um dos descontos.' },
  bloqueio_pagamento: { como: 'O bloqueio é encerrado em Lançamentos de cooperados → Bloqueios de pagamento.', aba: ['lancamentos', 'Ir para Bloqueios'] },
  situacao_cadastral: { como: 'A situação do cooperado é regularizada pelo setor de Benefícios, na ficha do cooperado.' },
  sem_processo_vinculado: { como: 'O setor de Faturamento precisa aprovar o processo da competência com este cooperado. Depois clique em "Atualizar pendências".' },
  recebimento_nao_confirmado: { como: 'Registre o recebimento da cobrança do cliente em Cobranças / Recebimentos. Depois clique em "Atualizar pendências".', aba: ['cobrancas', 'Ir para Cobranças'] },
};
const moeda = (v: string | number | null) => (v === null ? '—' : formatarMoeda(Number(v)));
const Badge: React.FC<{ s: string }> = ({ s }) => <span className={`badge-status ${SITUACAO[s]?.[1] ?? 'badge-inativo'}`}><span className="badge-status-dot" />{SITUACAO[s]?.[0] ?? s}</span>;

interface Props { podeExcecao: boolean; abasVisiveis: string[]; onIrPara: (aba: string) => void }

export const FilaPagamentos: React.FC<Props> = ({ podeExcecao, abasVisiveis, onIrPara }) => {
  const { showToast } = useToast();
  const [competencia, setCompetencia] = useState(competenciaAnterior);
  const [situacao, setSituacao] = useState('');
  const [todos, setTodos] = useState<PagamentoCooperado[]>([]);
  const [guia, setGuia] = useState<{ pagamento: PagamentoCooperado; pendencias: PendenciaPagamento[] } | null>(null);
  const [detalhe, setDetalhe] = useState<DetalhePagamento | null>(null);
  const [marcados, setMarcados] = useState<Set<number>>(new Set());
  const [lotes, setLotes] = useState<LotePagamento[]>([]);
  const [loteAberto, setLoteAberto] = useState<{ lote: LotePagamento; itens: ItemLote[] } | null>(null);
  const [modal, setModal] = useState<React.ComponentProps<typeof ModalFormulario> | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const carregar = async () => {
    try {
      const [f, l] = await Promise.all([listarFilaPagamentos({ competencia }), listarLotesPagamento()]);
      setTodos(f);
      setLotes(l);
      setMarcados(new Set());
      if (detalhe) setDetalhe(await obterPagamentoCooperado(detalhe.pagamento.id).catch(() => null));
      if (loteAberto) setLoteAberto(await obterLotePagamento(loteAberto.lote.id).catch(() => null));
    } catch (err: any) { showToast(err?.message || 'Erro ao carregar a fila.', 'error'); }
  };
  useEffect(() => { carregar(); setDetalhe(null); setSituacao(''); }, [competencia]);

  const executar = async (acao: () => Promise<unknown>, sucesso: string) => {
    setOcupado(true);
    try { await acao(); showToast(sucesso, 'success'); await carregar(); }
    catch (err: any) { showToast(err?.message || 'Não foi possível concluir a ação.', 'error'); }
    finally { setOcupado(false); }
  };
  const abrir = (cfg: Omit<React.ComponentProps<typeof ModalFormulario>, 'onClose' | 'onConfirmar'> & { acao: (v: ValoresFormulario) => Promise<unknown>; sucesso: string }) =>
    setModal({ ...cfg, onConfirmar: async (v) => { await cfg.acao(v); showToast(cfg.sucesso, 'success'); await carregar(); }, onClose: () => setModal(null) });
  const pedirMotivo = (titulo: string, acao: (m: string) => Promise<unknown>, sucesso: string, descricao?: string) =>
    abrir({ titulo, descricao, campos: [{ nome: 'motivo', rotulo: 'Motivo', tipo: 'textarea', obrigatorio: true }], acao: (v) => acao(v.motivo), sucesso });

  const corrigirDados = (p: PagamentoCooperado) => {
    setGuia(null);
    abrir({
      titulo: `Dados bancários — ${p.cooperado_nome}`,
      descricao: 'Informe a conta bancária ou a chave PIX. A alteração vai para a ficha do cooperado e fica no histórico. Depois, libere o pagamento.',
      campos: [{ nome: 'banco', rotulo: 'Banco', tipo: 'banco', campoCodigo: 'codigoBanco' }, ...camposBancarios({ tiposPix: ['cpf', 'email', 'telefone', 'aleatoria'], documentoTitular: p.cpf })],
      valoresIniciais: { banco: p.banco ?? '', codigoBanco: p.codigo_banco ?? '', agencia: p.agencia ?? '', conta: p.conta ?? '', digito: p.digito ?? '', tipoConta: p.tipo_conta ?? '', tipoPix: p.tipo_pix ?? '', chavePix: p.chave_pix ?? '' },
      acao: (v) => salvarDadosBancariosCooperado(p.candidato_id, v),
      sucesso: 'Dados bancários salvos.',
    });
  };
  const solicitarDados = (p: PagamentoCooperado) => {
    setGuia(null);
    abrir({
      titulo: `Solicitar dados bancários — ${p.cooperado_nome}`,
      descricao: 'O setor de Benefícios recebe um alerta para coletar os dados com o cooperado. A solicitação fica aberta nesta fila e se encerra sozinha quando os dados forem cadastrados.',
      campos: [{ nome: 'mensagem', rotulo: 'Observação para o setor', tipo: 'textarea' }],
      rotuloConfirmar: 'Enviar solicitação',
      acao: (v) => solicitarDadosBancarios(p.id, v.mensagem),
      sucesso: 'Solicitação enviada ao setor de Benefícios.',
    });
  };
  const liberarExcecao = (p: PagamentoCooperado, pendencias: PendenciaPagamento[]) => {
    setGuia(null);
    abrir({
      titulo: `Liberar ${p.codigo} por exceção`,
      descricao: <>Pendências: <ul style={{ margin: '4px 0 0 18px' }}>{pendencias.map((x) => <li key={x.codigo}>{x.descricao}</li>)}</ul>A exceção fica registrada com seu nome e a justificativa.</>,
      campos: [{ nome: 'motivo', rotulo: 'Justificativa da exceção', tipo: 'textarea', obrigatorio: true }],
      acao: (v) => liberarPagamentoCooperado(p.id, { excecao: true, motivo: v.motivo }),
      sucesso: 'Pagamento liberado por exceção.',
    });
  };

  const liberar = async (p: PagamentoCooperado) => {
    setOcupado(true);
    try {
      await liberarPagamentoCooperado(p.id);
      showToast(`${p.codigo} liberado. Agora pague e confirme, ou gere um lote.`, 'success');
      await carregar();
    } catch (err) {
      const e = err as ErroComDetalhes;
      if (e.pendencias?.length) {
        await carregar();
        setGuia({ pagamento: p, pendencias: e.pendencias });
      } else showToast(e.message, 'error');
    } finally { setOcupado(false); }
  };

  const fila = situacao ? todos.filter((p) => p.situacao === situacao) : todos;
  const liberados = fila.filter((p) => p.situacao === 'liberado');
  const selecionados = fila.filter((p) => marcados.has(p.id));
  const totalSelecionado = selecionados.reduce((s, p) => s + Number(p.valor_liquido), 0);
  const contagem = (s: string) => {
    const itens = todos.filter((p) => p.situacao === s);
    return { n: itens.length, total: itens.reduce((t, p) => t + Number(p.valor_liquido), 0) };
  };

  return (
    <>
      <div className="monitoramento-table-card">
        <div className="table-card-header">
          <div>
            <h3 className="table-card-title">Fila de pagamentos dos cooperados</h3>
            <p style={{ margin: '4px 0 0 0', fontSize: 13, color: '#64748b' }}>
              <strong>Como pagar:</strong> 1. Monte a fila · 2. Resolva as pendências · 3. Clique em Liberar · 4. Faça o pagamento no banco (individual ou por lote) · 5. Confirme como pago.
              O cooperado passa para a situação Pago só na confirmação.
            </p>
            <p style={{ margin: '4px 0 0 0', fontSize: 13, color: '#64748b' }}>
              Por padrão, o pagamento só é liberado com o recebimento do cliente confirmado (todas as cobranças dos processos de faturamento do cooperado pagas).
              Cooperados inativos, desligados ou bloqueados ficam retidos, sem perder valores. Exceções só para perfis autorizados, com justificativa.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <input type="month" className="filter-input" value={competencia} onChange={(e) => setCompetencia(e.target.value)} />
            <button type="button" className="btn-primary-filter" disabled={ocupado} onClick={() => executar(async () => {
              const r = await montarFilaPagamentos(competencia);
              r.avisos.forEach((a) => showToast(a, 'warning'));
            }, 'Fila montada com os lançamentos pendentes.')}>Montar fila</button>
            <button type="button" className="btn-secondary-filter" disabled={ocupado} onClick={() => executar(() => atualizarPendenciasFila(competencia), 'Pendências atualizadas.')}>↻ Atualizar pendências</button>
          </div>
        </div>
        {todos.length > 0 && (
          <div style={{ padding: '10px 24px', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className={situacao === '' ? 'btn-primary-filter' : 'btn-secondary-filter'} onClick={() => setSituacao('')}>Todos ({todos.length})</button>
            {Object.entries(SITUACAO).filter(([k]) => contagem(k).n > 0).map(([k, [rotulo]]) => (
              <button key={k} type="button" className={situacao === k ? 'btn-primary-filter' : 'btn-secondary-filter'} onClick={() => setSituacao(situacao === k ? '' : k)}>
                {rotulo} ({contagem(k).n} · {moeda(contagem(k).total)})
              </button>
            ))}
          </div>
        )}
        {liberados.length > 0 && (
          <div style={{ padding: '10px 24px', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', background: '#f8fafc' }}>
            <label style={{ fontSize: 13, display: 'flex', gap: 6, alignItems: 'center' }}>
              <input type="checkbox" checked={selecionados.length === liberados.length} onChange={(e) => setMarcados(new Set(e.target.checked ? liberados.map((p) => p.id) : []))} /> Todos os liberados
            </label>
            <span style={{ fontSize: 13 }}>{marcados.size} selecionado(s) · {moeda(totalSelecionado)}</span>
            <button type="button" className="btn-action-view" disabled={ocupado || marcados.size === 0} onClick={() => abrir({
              titulo: `Marcar ${marcados.size} pagamento(s) como pago(s)`,
              descricao: `Use quando o pagamento já foi feito no banco, fora de lote. Total: ${moeda(totalSelecionado)}. Para anexar o comprovante, use "Confirmar pago" em cada cooperado.`,
              campos: [{ nome: 'dataPagamento', rotulo: 'Data do pagamento', tipo: 'data', obrigatorio: true }, { nome: 'motivo', rotulo: 'Observação', tipo: 'textarea' }],
              valoresIniciais: { dataPagamento: dataLocalISO() },
              acao: (v) => confirmarPagamentosCooperados({ ids: [...marcados], dataPagamento: v.dataPagamento, motivo: v.motivo }), sucesso: 'Pagamentos confirmados.',
            })}>Marcar como pagos</button>
            <button type="button" className="btn-save-ajuste" disabled={ocupado || marcados.size === 0} onClick={() => abrir({
              titulo: 'Gerar lote de pagamento',
              descricao: 'Sem o leiaute oficial do banco cadastrado, o sistema gera uma planilha de conferência (CSV) para pagamento no internet banking. Gerar o lote não conclui os pagamentos: confirme ou rejeite cada item depois.',
              campos: [
                { nome: 'modalidade', rotulo: 'Modalidade', tipo: 'select', obrigatorio: true, opcoes: MODALIDADES },
                { nome: 'bancoCodigo', rotulo: 'Banco pagador (código)', placeholder: 'Ex: 341', ajuda: 'Obrigatório para crédito em conta.', numerico: true, formatar: soDigitos(3) },
              ],
              valoresIniciais: { modalidade: 'pix' },
              acao: async (v) => {
                const r = await criarLotePagamento({ modalidade: v.modalidade, bancoCodigo: v.bancoCodigo || undefined, pagamentoIds: [...marcados] });
                if (r.aviso) showToast(r.aviso, 'warning');
              },
              sucesso: 'Lote gerado.',
            })}>Gerar lote</button>
          </div>
        )}
        <div className="table-responsive">
          <table className="monitoramento-table" style={{ fontSize: 12 }}>
            <thead><tr><th /><th>Pagamento</th><th>Cooperado</th><th>Dados bancários</th><th style={{ textAlign: 'right' }}>Créditos</th><th style={{ textAlign: 'right' }}>Descontos</th><th style={{ textAlign: 'right' }}>Líquido</th><th>Situação / pendências</th><th /></tr></thead>
            <tbody>
              {fila.length === 0 ? <tr><td colSpan={9} style={{ textAlign: 'center', padding: 24, color: '#94a3b8' }}>Nenhum pagamento nesta competência. Gere os lançamentos e monte a fila.</td></tr>
                : fila.map((p) => (
                  <tr key={p.id} style={{ background: detalhe?.pagamento.id === p.id ? '#f0fdf4' : undefined }}>
                    <td>{p.situacao === 'liberado' && <input type="checkbox" checked={marcados.has(p.id)} onChange={() => { const s = new Set(marcados); if (s.has(p.id)) s.delete(p.id); else s.add(p.id); setMarcados(s); }} />}</td>
                    <td><button type="button" style={{ border: 'none', background: 'none', color: '#2563eb', cursor: 'pointer', padding: 0, fontWeight: 600 }}
                      onClick={async () => setDetalhe(detalhe?.pagamento.id === p.id ? null : await obterPagamentoCooperado(p.id))}>{p.codigo}</button>
                      <div style={{ color: '#64748b' }}>{p.tipo === 'adiantamento' ? 'Adiantamento' : 'Repasse'}</div></td>
                    <td><strong>{p.cooperado_nome}</strong>{p.matricula && <div style={{ color: '#64748b' }}>Mat. {p.matricula}</div>}</td>
                    <td>{p.conta ? `${p.codigo_banco ?? ''} ag ${p.agencia} cc ${p.conta}-${p.digito ?? ''}` : ''}{p.chave_pix && <div>PIX {p.tipo_pix}: {p.chave_pix}</div>}{!p.conta && !p.chave_pix && <span style={{ color: '#b91c1c' }}>Não cadastrados</span>}
                      {p.solicitacao_em && <div style={{ color: '#92400e' }}>Solicitados ao setor de Benefícios em {formatarDataBR(p.solicitacao_em)} ({p.solicitacao_por_nome})</div>}
                      {SITUACOES_ABERTAS.includes(p.situacao) && (
                        <div style={{ marginTop: 4 }}>
                          <button type="button" className="btn-action-edit" disabled={ocupado} onClick={() => corrigirDados(p)}>Corrigir</button>{' '}
                          {!p.solicitacao_em && p.pendencias.some((x) => PENDENCIAS_BANCARIAS.includes(x.codigo)) && <button type="button" className="btn-action-obs" disabled={ocupado} onClick={() => solicitarDados(p)}>Solicitar ao setor</button>}
                        </div>
                      )}
                      {p.situacao === 'liberado' && <div style={{ color: '#64748b' }}>Para alterar, desfaça a liberação.</div>}
                    </td>
                    <td style={{ textAlign: 'right' }}>{moeda(p.valor_creditos)}</td>
                    <td style={{ textAlign: 'right' }}>{moeda(p.valor_debitos)}</td>
                    <td style={{ textAlign: 'right' }}><strong>{moeda(p.valor_liquido)}</strong></td>
                    <td style={{ maxWidth: 300 }}>
                      <Badge s={p.situacao} />
                      {p.excecao ? <div style={{ color: '#b45309' }}>Exceção: {p.excecao_motivo} ({p.excecao_por_nome})</div> : null}
                      {p.motivo_situacao && <div style={{ color: '#64748b' }}>{p.motivo_situacao}</div>}
                      {['em_preparacao', 'retido', 'rejeitado'].includes(p.situacao) && p.pendencias.map((x) => (
                        <div key={x.codigo} style={{ color: x.excepcionavel ? '#92400e' : '#b91c1c' }}>• {x.descricao}</div>
                      ))}
                      {p.situacao === 'liberado' && <div style={{ color: '#64748b' }}>Pronto para pagar: pague no banco e confirme, ou selecione para gerar lote.</div>}
                      {p.situacao === 'em_lote' && <div style={{ color: '#64748b' }}>Confirme "Pago" ou "Rejeitado" no lote, abaixo.</div>}
                      {p.data_pagamento && <div style={{ color: '#64748b' }}>Pago em {formatarDataBR(p.data_pagamento)} ({p.confirmado_por_nome})</div>}
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {['em_preparacao', 'retido', 'rejeitado'].includes(p.situacao) && <button type="button" className="btn-action-view" disabled={ocupado} onClick={() => liberar(p)}>Liberar</button>}{' '}
                      {p.situacao === 'liberado' && (
                        <>
                          <button type="button" className="btn-action-view" disabled={ocupado} onClick={() => abrir({
                            titulo: `Confirmar pagamento ${p.codigo}`, descricao: `Pagamento feito fora de lote (ex.: PIX manual). Valor ${moeda(p.valor_liquido)}.`,
                            campos: [
                              { nome: 'dataPagamento', rotulo: 'Data do pagamento', tipo: 'data', obrigatorio: true },
                              { nome: 'comprovante', rotulo: 'Comprovante', tipo: 'arquivo', aceitar: '.pdf,.png,.jpg,.jpeg' },
                              { nome: 'motivo', rotulo: 'Observação', tipo: 'textarea' },
                            ],
                            valoresIniciais: { dataPagamento: dataLocalISO() },
                            acao: (v) => confirmarPagamentoCooperado(p.id, { ...v, comprovante: v.comprovante || undefined }), sucesso: 'Pagamento confirmado.',
                          })}>Confirmar pago</button>{' '}
                          <button type="button" className="btn-action-edit" disabled={ocupado} onClick={() => pedirMotivo(`Desfazer liberação de ${p.codigo}`, (m) => desfazerLiberacao(p.id, m), 'Liberação desfeita.')}>Desfazer</button>{' '}
                        </>
                      )}
                      {['em_preparacao', 'liberado', 'retido', 'rejeitado'].includes(p.situacao) && (
                        <button type="button" className="btn-action-obs" disabled={ocupado} onClick={() => pedirMotivo(`Cancelar ${p.codigo}`, (m) => cancelarPagamentoCooperado(p.id, m), 'Pagamento cancelado.',
                          p.tipo === 'repasse' ? 'Os lançamentos voltam a ficar pendentes para um próximo pagamento.' : 'O adiantamento e a compensação dele são cancelados.')}>Cancelar</button>
                      )}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        {detalhe && (
          <div style={{ padding: '14px 24px', borderTop: '2px solid #e2e8f0' }}>
            <h4 style={{ margin: '0 0 6px' }}>{detalhe.pagamento.codigo} — {detalhe.pagamento.cooperado_nome}</h4>
            {detalhe.pagamento.processos_vinculados.length > 0 && (
              <div style={{ fontSize: 12, color: '#64748b' }}>Processos vinculados: {detalhe.pagamento.processos_vinculados.map((x) => `${x.codigo} [${x.cobrancas.join(', ') || 'sem cobranças'}]`).join(' · ')}</div>
            )}
            <table className="monitoramento-table" style={{ fontSize: 12, marginTop: 6 }}>
              <thead><tr><th>Competência</th><th>Descrição</th><th>Origem</th><th style={{ textAlign: 'right' }}>Crédito</th><th style={{ textAlign: 'right' }}>Débito</th><th>Situação</th><th /></tr></thead>
              <tbody>
                {detalhe.lancamentos.map((l) => (
                  <tr key={l.id}>
                    <td>{l.competencia}</td><td>{l.descricao}</td><td>{l.origem}</td>
                    <td style={{ textAlign: 'right' }}>{l.tipo === 'credito' ? moeda(l.valor) : ''}</td>
                    <td style={{ textAlign: 'right' }}>{l.tipo === 'debito' ? moeda(l.valor) : ''}</td>
                    <td>{l.situacao}</td>
                    <td>{l.tipo === 'debito' && l.situacao === 'reservado' && ['em_preparacao', 'retido', 'rejeitado'].includes(detalhe.pagamento.situacao) && (
                      <button type="button" className="btn-action-edit" onClick={() => abrir({
                        titulo: 'Adiar este desconto', descricao: 'O desconto sai deste pagamento e volta a ficar pendente a partir da competência informada.',
                        campos: [{ nome: 'compensarAPartir', rotulo: 'Descontar a partir de (AAAA-MM)', obrigatorio: true }, { nome: 'motivo', rotulo: 'Motivo', tipo: 'textarea', obrigatorio: true }],
                        acao: (v) => adiarCompensacao(l.id, v.compensarAPartir, v.motivo), sucesso: 'Desconto adiado.',
                      })}>Adiar</button>
                    )}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <details style={{ marginTop: 8, fontSize: 12 }}>
              <summary>Histórico ({detalhe.historico.length})</summary>
              {detalhe.historico.map((h) => (
                <div key={h.id}>{new Date(h.criado_em.replace(' ', 'T')).toLocaleString('pt-BR')} · <strong>{h.usuario_nome}</strong> · {h.acao}{h.motivo ? ` · ${h.motivo}` : ''}</div>
              ))}
            </details>
          </div>
        )}
      </div>

      <div className="monitoramento-table-card">
        <div className="table-card-header">
          <div>
            <h3 className="table-card-title">Lotes de pagamento / remessas</h3>
            <p style={{ margin: '4px 0 0 0', fontSize: 13, color: '#64748b' }}>
              Nenhum leiaute de remessa foi fornecido pela ATESA: os lotes geram a planilha de conferência. Cada pagamento só fica "pago" com a confirmação do item
              (comprovante/extrato/retorno do banco). Um pagamento não pode estar em dois lotes ativos.
            </p>
          </div>
        </div>
        <div className="table-responsive">
          <table className="monitoramento-table" style={{ fontSize: 12 }}>
            <thead><tr><th>Lote</th><th>Modalidade</th><th>Arquivo</th><th style={{ textAlign: 'right' }}>Itens</th><th style={{ textAlign: 'right' }}>Total</th><th>Situação</th><th /></tr></thead>
            <tbody>
              {lotes.length === 0 ? <tr><td colSpan={7} style={{ textAlign: 'center', padding: 20, color: '#94a3b8' }}>Nenhum lote gerado.</td></tr>
                : lotes.map((l) => (
                  <React.Fragment key={l.id}>
                    <tr style={{ background: loteAberto?.lote.id === l.id ? '#f0fdf4' : undefined }}>
                      <td><button type="button" style={{ border: 'none', background: 'none', color: '#2563eb', cursor: 'pointer', padding: 0, fontWeight: 600 }}
                        onClick={async () => setLoteAberto(loteAberto?.lote.id === l.id ? null : await obterLotePagamento(l.id))}>{l.codigo}</button>
                        <div style={{ color: '#64748b' }}>{new Date(l.gerado_em.replace(' ', 'T')).toLocaleString('pt-BR')} · {l.gerado_por_nome}</div></td>
                      <td>{MODALIDADES.find((m) => m.valor === l.modalidade)?.rotulo}{l.banco_codigo ? ` · ${l.banco_codigo}` : ''}</td>
                      <td>{l.leiaute === 'conferencia_csv' ? 'Planilha de conferência' : `Remessa ${l.leiaute}`}{l.documento_id && (
                        <button type="button" style={{ marginLeft: 6, border: 'none', background: 'none', color: '#2563eb', cursor: 'pointer' }}
                          onClick={() => baixarDocumentoFinanceiro(l.documento_id!, `${l.codigo}${l.leiaute === 'conferencia_csv' ? '-conferencia.csv' : '.rem'}`).catch((e) => showToast(e?.message || 'Erro.', 'error'))}>⬇</button>
                      )}</td>
                      <td style={{ textAlign: 'right' }}>{l.total_itens}{Number(l.itens_rejeitados) ? ` (${l.itens_rejeitados} rejeitado)` : ''}</td>
                      <td style={{ textAlign: 'right' }}>{moeda(l.valor_total)}</td>
                      <td>{{ gerado: 'Gerado', enviado: `Enviado (${l.enviado_por_nome ?? ''})`, processado: 'Processado', cancelado: `Cancelado: ${l.motivo_cancelamento ?? ''}` }[l.situacao] ?? l.situacao}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {l.situacao === 'gerado' && <button type="button" className="btn-action-view" disabled={ocupado} onClick={() => executar(() => marcarLoteEnviado(l.id), 'Envio registrado.')}>Marcar enviado</button>}{' '}
                        {['gerado', 'enviado'].includes(l.situacao) && !Number(l.itens_confirmados) && !Number(l.itens_rejeitados) && (
                          <button type="button" className="btn-action-obs" disabled={ocupado} onClick={() => pedirMotivo(`Cancelar ${l.codigo}`, (m) => cancelarLotePagamento(l.id, m), 'Lote cancelado.',
                            l.situacao === 'enviado' ? 'O lote já foi enviado: confirme no banco que nenhum pagamento foi efetuado.' : 'Os pagamentos voltam para "liberado".')}>Cancelar</button>
                        )}
                      </td>
                    </tr>
                    {loteAberto?.lote.id === l.id && (
                      <tr><td colSpan={7} style={{ background: '#f8fafc', padding: 0 }}>
                        <table className="monitoramento-table" style={{ fontSize: 12, margin: 0 }}>
                          <tbody>
                            {loteAberto.itens.map((i) => (
                              <tr key={i.id}>
                                <td>{i.pagamento_codigo}</td><td>{i.cooperado_nome}</td>
                                <td>{l.modalidade === 'pix' ? `PIX ${i.favorecido.tipo_pix}: ${i.favorecido.chave_pix}` : `${i.favorecido.codigo_banco} ag ${i.favorecido.agencia} cc ${i.favorecido.conta}-${i.favorecido.digito}`}</td>
                                <td style={{ textAlign: 'right' }}>{moeda(i.valor)}</td>
                                <td>{i.situacao}{i.ocorrencia_descricao && ` — ${i.ocorrencia_codigo ? `${i.ocorrencia_codigo} ` : ''}${i.ocorrencia_descricao}`}</td>
                                <td style={{ whiteSpace: 'nowrap' }}>{i.situacao === 'incluido' && l.situacao !== 'cancelado' && (
                                  <>
                                    <button type="button" className="btn-action-view" onClick={() => abrir({
                                      titulo: `Confirmar pagamento de ${i.cooperado_nome}`,
                                      campos: [
                                        { nome: 'dataPagamento', rotulo: 'Data do pagamento', tipo: 'data', obrigatorio: true },
                                        { nome: 'codigo', rotulo: 'Código da ocorrência (retorno)', largura: 'metade' },
                                        { nome: 'descricao', rotulo: 'Observação', largura: 'metade' },
                                        { nome: 'comprovante', rotulo: 'Comprovante', tipo: 'arquivo', aceitar: '.pdf,.png,.jpg,.jpeg' },
                                      ],
                                      acao: (v) => registrarOcorrenciaLote(i.id, { situacao: 'confirmado', ...v, comprovante: v.comprovante || undefined }), sucesso: 'Pagamento confirmado.',
                                    })}>Pago</button>{' '}
                                    <button type="button" className="btn-action-obs" onClick={() => abrir({
                                      titulo: `Rejeição do banco — ${i.cooperado_nome}`, descricao: 'O pagamento volta para correção (ex.: dados bancários) e precisa ser liberado de novo.',
                                      campos: [{ nome: 'codigo', rotulo: 'Código da ocorrência' }, { nome: 'descricao', rotulo: 'Motivo da rejeição', tipo: 'textarea', obrigatorio: true }],
                                      acao: (v) => registrarOcorrenciaLote(i.id, { situacao: 'rejeitado', ...v }), sucesso: 'Rejeição registrada.',
                                    })}>Rejeitado</button>
                                  </>
                                )}</td>
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
      {modal && <ModalFormulario {...modal} />}
      {guia && (
        <div className="modal-overlay-custom" onClick={() => setGuia(null)}>
          <div className="modal-dialog-custom" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 640 }}>
            <div className="modal-dialog-header">
              <h3>{guia.pagamento.codigo} ainda não pode ser liberado</h3>
              <button type="button" className="modal-close-btn" onClick={() => setGuia(null)} aria-label="Fechar">✕</button>
            </div>
            <div className="modal-dialog-body" style={{ maxHeight: '65vh', overflowY: 'auto', fontSize: 13 }}>
              <p style={{ margin: 0 }}><strong>{guia.pagamento.cooperado_nome}</strong> · líquido {moeda(guia.pagamento.valor_liquido)}. Resolva o que falta:</p>
              {guia.pendencias.map((x) => {
                const caminho = CAMINHO_PENDENCIA[x.codigo];
                return (
                  <div key={x.codigo} style={{ padding: 12, borderRadius: 8, border: `1px solid ${x.excepcionavel ? '#fde68a' : '#fecaca'}`, background: x.excepcionavel ? '#fffbeb' : '#fef2f2' }}>
                    <strong>{x.descricao}</strong>
                    {caminho && <div style={{ marginTop: 4, color: '#475569' }}>{caminho.como}</div>}
                    <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {PENDENCIAS_BANCARIAS.includes(x.codigo) && <button type="button" className="btn-action-edit" onClick={() => corrigirDados(guia.pagamento)}>Corrigir dados bancários</button>}
                      {PENDENCIAS_BANCARIAS.includes(x.codigo) && (guia.pagamento.solicitacao_em
                        ? <span style={{ color: '#92400e' }}>Solicitação enviada em {formatarDataBR(guia.pagamento.solicitacao_em)} ({guia.pagamento.solicitacao_por_nome}).</span>
                        : <button type="button" className="btn-action-obs" onClick={() => solicitarDados(guia.pagamento)}>Solicitar ao setor responsável</button>)}
                      {caminho?.aba && abasVisiveis.includes(caminho.aba[0]) && <button type="button" className="btn-action-view" onClick={() => { setGuia(null); onIrPara(caminho.aba![0]); }}>{caminho.aba[1]}</button>}
                    </div>
                  </div>
                );
              })}
              {guia.pendencias.every((x) => x.excepcionavel) && (podeExcecao
                ? <p style={{ margin: 0 }}>Se o pagamento precisa sair antes disso, você pode liberar por exceção, com justificativa.</p>
                : <p style={{ margin: 0, color: '#64748b' }}>A liberação por exceção é feita pelo Administrador ou por usuário com essa permissão em Permissões e Grupos.</p>)}
            </div>
            <div className="modal-dialog-footer">
              <button type="button" className="btn-cancel" onClick={() => setGuia(null)}>Fechar</button>
              {podeExcecao && guia.pendencias.every((x) => x.excepcionavel) && <button type="button" className="btn-save-ajuste" onClick={() => liberarExcecao(guia.pagamento, guia.pendencias)}>Liberar por exceção</button>}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default FilaPagamentos;
