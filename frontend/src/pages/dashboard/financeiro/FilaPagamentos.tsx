import React, { useEffect, useState } from 'react';
import '../monitoramento/Monitoramento.css';
import { useToast } from '../../../components/ToastContext';
import { dataLocalISO, formatarDataBR, formatarMoeda } from '../../../utils/formatters';
import {
  DetalhePagamento, ErroComDetalhes, ItemLote, LotePagamento, PagamentoCooperado, adiarCompensacao, atualizarPendenciasFila, baixarDocumentoFinanceiro,
  cancelarLotePagamento, cancelarPagamentoCooperado, confirmarPagamentoCooperado, criarLotePagamento, desfazerLiberacao, liberarPagamentoCooperado,
  listarFilaPagamentos, listarLotesPagamento, marcarLoteEnviado, montarFilaPagamentos, obterLotePagamento, obterPagamentoCooperado, registrarOcorrenciaLote,
} from '../../../api/financeiroApi';
import ModalFormulario, { ValoresFormulario } from './ModalFormulario';

const competenciaAnterior = (() => {
  const [a, m] = dataLocalISO().split('-').map(Number);
  const d = new Date(a, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
})();
const SITUACAO: Record<string, [string, string]> = {
  em_preparacao: ['Em preparação', 'badge-pendente'], liberado: ['Liberado', 'badge-ativo'], em_lote: ['Em lote (aguardando banco)', 'badge-ativo'],
  pago: ['Pago', 'badge-em-atividade'], rejeitado: ['Rejeitado pelo banco', 'badge-divergente'], retido: ['Retido', 'badge-divergente'], cancelado: ['Cancelado', 'badge-inativo'],
};
const MODALIDADES = [{ valor: 'credito_conta', rotulo: 'Crédito em conta (mesmo banco)' }, { valor: 'ted', rotulo: 'TED' }, { valor: 'pix', rotulo: 'PIX' }];
const moeda = (v: string | number | null) => (v === null ? '—' : formatarMoeda(Number(v)));
const Badge: React.FC<{ s: string }> = ({ s }) => <span className={`badge-status ${SITUACAO[s]?.[1] ?? 'badge-inativo'}`}><span className="badge-status-dot" />{SITUACAO[s]?.[0] ?? s}</span>;

interface Props { podeExcecao: boolean }

export const FilaPagamentos: React.FC<Props> = ({ podeExcecao }) => {
  const { showToast } = useToast();
  const [competencia, setCompetencia] = useState(competenciaAnterior);
  const [situacao, setSituacao] = useState('');
  const [fila, setFila] = useState<PagamentoCooperado[]>([]);
  const [detalhe, setDetalhe] = useState<DetalhePagamento | null>(null);
  const [marcados, setMarcados] = useState<Set<number>>(new Set());
  const [lotes, setLotes] = useState<LotePagamento[]>([]);
  const [loteAberto, setLoteAberto] = useState<{ lote: LotePagamento; itens: ItemLote[] } | null>(null);
  const [modal, setModal] = useState<React.ComponentProps<typeof ModalFormulario> | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const carregar = async () => {
    try {
      const [f, l] = await Promise.all([listarFilaPagamentos({ competencia, situacao: situacao || undefined }), listarLotesPagamento()]);
      setFila(f);
      setLotes(l);
      setMarcados(new Set());
      if (detalhe) setDetalhe(await obterPagamentoCooperado(detalhe.pagamento.id).catch(() => null));
      if (loteAberto) setLoteAberto(await obterLotePagamento(loteAberto.lote.id).catch(() => null));
    } catch (err: any) { showToast(err?.message || 'Erro ao carregar a fila.', 'error'); }
  };
  useEffect(() => { carregar(); setDetalhe(null); }, [competencia, situacao]);

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

  const liberar = async (p: PagamentoCooperado) => {
    setOcupado(true);
    try {
      await liberarPagamentoCooperado(p.id);
      showToast(`${p.codigo} liberado.`, 'success');
      await carregar();
    } catch (err) {
      const e = err as ErroComDetalhes;
      if (e.codigo === 'EXIGE_EXCECAO' && podeExcecao) {
        abrir({
          titulo: `Liberar ${p.codigo} por exceção`,
          descricao: <>Pendências: <ul style={{ margin: '4px 0 0 18px' }}>{(e.detalhes ?? []).map((d, i) => <li key={i}>{d}</li>)}</ul>A exceção fica registrada com seu nome e a justificativa.</>,
          campos: [{ nome: 'motivo', rotulo: 'Justificativa da exceção', tipo: 'textarea', obrigatorio: true }],
          acao: (v) => liberarPagamentoCooperado(p.id, { excecao: true, motivo: v.motivo }),
          sucesso: 'Pagamento liberado por exceção.',
        });
      } else showToast(e.message, 'error');
    } finally { setOcupado(false); }
  };

  const liberados = fila.filter((p) => p.situacao === 'liberado');
  const totalSelecionado = fila.filter((p) => marcados.has(p.id)).reduce((s, p) => s + Number(p.valor_liquido), 0);

  return (
    <>
      <div className="monitoramento-table-card">
        <div className="table-card-header">
          <div>
            <h3 className="table-card-title">Fila de pagamentos dos cooperados</h3>
            <p style={{ margin: '4px 0 0 0', fontSize: 13, color: '#64748b' }}>
              Por padrão, o pagamento só é liberado com o recebimento do cliente confirmado (todas as cobranças dos processos de faturamento do cooperado pagas).
              Cooperados inativos, desligados ou bloqueados ficam retidos, sem perder valores. Exceções só para perfis autorizados, com justificativa.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <input type="month" className="filter-input" value={competencia} onChange={(e) => setCompetencia(e.target.value)} />
            <select className="filter-select" value={situacao} onChange={(e) => setSituacao(e.target.value)}>
              <option value="">Todas as situações</option>
              {Object.entries(SITUACAO).map(([k, [r]]) => <option key={k} value={k}>{r}</option>)}
            </select>
            <button type="button" className="btn-primary-filter" disabled={ocupado} onClick={() => executar(async () => {
              const r = await montarFilaPagamentos(competencia);
              r.avisos.forEach((a) => showToast(a, 'warning'));
            }, 'Fila montada com os lançamentos pendentes.')}>Montar fila</button>
            <button type="button" className="btn-secondary-filter" disabled={ocupado} onClick={() => executar(() => atualizarPendenciasFila(competencia), 'Pendências atualizadas.')}>↻ Atualizar pendências</button>
          </div>
        </div>
        {liberados.length > 0 && (
          <div style={{ padding: '10px 24px', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', background: '#f8fafc' }}>
            <span style={{ fontSize: 13 }}>{marcados.size} selecionado(s) · {moeda(totalSelecionado)}</span>
            <button type="button" className="btn-save-ajuste" disabled={ocupado || marcados.size === 0} onClick={() => abrir({
              titulo: 'Gerar lote de pagamento',
              descricao: 'Sem o leiaute oficial do banco cadastrado, o sistema gera uma planilha de conferência (CSV) para pagamento no internet banking. Gerar o lote não conclui os pagamentos: confirme ou rejeite cada item depois.',
              campos: [
                { nome: 'modalidade', rotulo: 'Modalidade', tipo: 'select', obrigatorio: true, opcoes: MODALIDADES },
                { nome: 'bancoCodigo', rotulo: 'Banco pagador (código)', placeholder: 'Ex: 341', ajuda: 'Obrigatório para crédito em conta.' },
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
                    <td>{p.conta ? `${p.codigo_banco ?? ''} ag ${p.agencia} cc ${p.conta}-${p.digito ?? ''}` : ''}{p.chave_pix && <div>PIX {p.tipo_pix}: {p.chave_pix}</div>}{!p.conta && !p.chave_pix && <span style={{ color: '#b91c1c' }}>Não cadastrados</span>}</td>
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
    </>
  );
};

export default FilaPagamentos;
