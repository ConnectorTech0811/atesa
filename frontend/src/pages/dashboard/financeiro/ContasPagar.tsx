import React, { useEffect, useState } from 'react';
import '../monitoramento/Monitoramento.css';
import { useToast } from '../../../components/ToastContext';
import { dataLocalISO, formatarDataBR, formatarMoeda, formatarTelefone } from '../../../utils/formatters';
import {
  AuditoriaFinanceira, CategoriaConta, ContaPagar, DocumentoFinanceiro, Fornecedor, anexarDocumentoContaPagar, aprovarContaPagar, atualizarContaPagar,
  baixarContaPagar, baixarDocumentoFinanceiro, cancelarContaPagar, criarContaPagar, estornarBaixaContaPagar, listarCategoriasContas, listarContasPagar,
  listarFornecedores, obterContaPagar, programarContaPagar, rejeitarContaPagar, salvarCategoriaConta, salvarFornecedor,
} from '../../../api/financeiroApi';
import ModalFormulario, { CampoFormulario, ValoresFormulario } from './ModalFormulario';
import { camposBancarios, mascaraDocumento, mascaraTelefone, validarDocumento, validarEmail, validarTelefone } from './camposBancarios';

const SITUACAO: Record<string, [string, string]> = {
  aguardando_aprovacao: ['Aguardando aprovação', 'badge-pendente'], aprovada: ['Aprovada', 'badge-ativo'], programada: ['Programada', 'badge-ativo'],
  paga: ['Paga', 'badge-em-atividade'], rejeitada: ['Rejeitada', 'badge-divergente'], cancelada: ['Cancelada', 'badge-inativo'],
};
const TIPOS_DOC = [
  { valor: 'nfe', rotulo: 'NF-e' }, { valor: 'nfse', rotulo: 'NFS-e' }, { valor: 'boleto', rotulo: 'Boleto' }, { valor: 'recibo', rotulo: 'Recibo' },
  { valor: 'fatura', rotulo: 'Fatura' }, { valor: 'outro', rotulo: 'Outro' },
];
const FORMAS = [
  { valor: 'boleto', rotulo: 'Boleto' }, { valor: 'pix', rotulo: 'PIX' }, { valor: 'transferencia', rotulo: 'Transferência' },
  { valor: 'debito_automatico', rotulo: 'Débito automático' }, { valor: 'dinheiro', rotulo: 'Dinheiro' }, { valor: 'outro', rotulo: 'Outro' },
];
const moeda = (v: string | number | null) => (v === null ? '—' : formatarMoeda(Number(v)));
const dec = (v: string | null) => (v === null ? '' : String(Number(v)).replace('.', ','));

interface Props { podeAprovar: boolean }

export const ContasPagar: React.FC<Props> = ({ podeAprovar }) => {
  const { showToast } = useToast();
  const [filtro, setFiltro] = useState('aguardando_aprovacao,aprovada,programada,rejeitada');
  const [contas, setContas] = useState<ContaPagar[]>([]);
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [categorias, setCategorias] = useState<CategoriaConta[]>([]);
  const [aberta, setAberta] = useState<{ conta: ContaPagar; anexos: DocumentoFinanceiro[]; historico: AuditoriaFinanceira[] } | null>(null);
  const [visao, setVisao] = useState<'contas' | 'fornecedores' | 'categorias'>('contas');
  const [modal, setModal] = useState<React.ComponentProps<typeof ModalFormulario> | null>(null);

  const carregar = async () => {
    try {
      const f = filtro === 'vencidas' ? { vencidas: true } : { situacao: filtro || undefined };
      const [c, fo, ca] = await Promise.all([listarContasPagar(f), listarFornecedores({ incluirInativos: true }), listarCategoriasContas(true)]);
      setContas(c);
      setFornecedores(fo);
      setCategorias(ca);
      if (aberta) setAberta(await obterContaPagar(aberta.conta.id).catch(() => null));
    } catch (err: any) { showToast(err?.message || 'Erro ao carregar contas a pagar.', 'error'); }
  };
  useEffect(() => { carregar(); }, [filtro]);

  const abrir = (cfg: Omit<React.ComponentProps<typeof ModalFormulario>, 'onClose' | 'onConfirmar'> & { acao: (v: ValoresFormulario) => Promise<unknown>; sucesso: string }) =>
    setModal({ ...cfg, onConfirmar: async (v) => { await cfg.acao(v); showToast(cfg.sucesso, 'success'); await carregar(); }, onClose: () => setModal(null) });
  const pedirMotivo = (titulo: string, acao: (m: string) => Promise<unknown>, sucesso: string) =>
    abrir({ titulo, campos: [{ nome: 'motivo', rotulo: 'Motivo', tipo: 'textarea', obrigatorio: true }], acao: (v) => acao(v.motivo), sucesso });

  const camposConta: CampoFormulario[] = [
    { nome: 'fornecedorId', rotulo: 'Fornecedor', tipo: 'select', obrigatorio: true, opcoes: fornecedores.filter((f) => f.ativo).map((f) => ({ valor: f.id, rotulo: `${f.nome} (${f.documento})` })) },
    { nome: 'categoriaId', rotulo: 'Categoria', tipo: 'select', obrigatorio: true, largura: 'metade', opcoes: categorias.filter((c) => c.ativa).map((c) => ({ valor: c.id, rotulo: c.nome })) },
    { nome: 'competencia', rotulo: 'Competência', tipo: 'mes', obrigatorio: true, largura: 'metade' },
    { nome: 'descricao', rotulo: 'Descrição', obrigatorio: true },
    { nome: 'valor', rotulo: 'Valor', tipo: 'numero', obrigatorio: true, largura: 'metade' },
    { nome: 'vencimento', rotulo: 'Vencimento', tipo: 'data', obrigatorio: true, largura: 'metade' },
    { nome: 'documentoTipo', rotulo: 'Documento fiscal', tipo: 'select', obrigatorio: true, largura: 'metade', opcoes: TIPOS_DOC },
    { nome: 'documentoNumero', rotulo: 'Número do documento', largura: 'metade', ajuda: 'O mesmo documento do mesmo fornecedor não pode ser lançado duas vezes.' },
    { nome: 'documentoEmissao', rotulo: 'Emissão do documento', tipo: 'data', largura: 'metade' },
    { nome: 'observacao', rotulo: 'Observação', tipo: 'textarea' },
  ];
  const camposFornecedor: CampoFormulario[] = [
    { nome: 'nome', rotulo: 'Nome / razão social', obrigatorio: true },
    { nome: 'documento', rotulo: 'CPF/CNPJ', obrigatorio: true, largura: 'metade', numerico: true, placeholder: 'Somente números', formatar: mascaraDocumento, validar: validarDocumento },
    { nome: 'telefone', rotulo: 'Telefone', largura: 'metade', numerico: true, placeholder: '(00) 00000-0000', formatar: mascaraTelefone, validar: validarTelefone },
    { nome: 'email', rotulo: 'E-mail', validar: validarEmail },
    ...camposBancarios({ tiposPix: ['cpf', 'cnpj', 'email', 'telefone', 'aleatoria'] }),
    { nome: 'ativo', rotulo: 'Situação', tipo: 'checkbox', placeholder: 'Ativo' },
    { nome: 'observacao', rotulo: 'Observação', tipo: 'textarea' },
  ];

  const novaConta = (fornecedorId?: number) => {
    const ativos = fornecedores.filter((f) => f.ativo);
    const ativas = categorias.filter((c) => c.ativa);
    if (!ativos.length || !ativas.length) {
      showToast(`Antes de lançar uma conta, cadastre ${!ativos.length ? 'um fornecedor ativo' : 'uma categoria ativa'}.`, 'warning');
      setVisao(!ativos.length ? 'fornecedores' : 'categorias');
      return;
    }
    abrir({
      titulo: 'Nova conta a pagar', campos: camposConta,
      valoresIniciais: { competencia: dataLocalISO().slice(0, 7), documentoTipo: 'nfse', fornecedorId: fornecedorId ?? (ativos.length === 1 ? ativos[0].id : ''), categoriaId: ativas.length === 1 ? ativas[0].id : '' },
      acao: (v) => criarContaPagar(v), sucesso: 'Conta lançada (aguardando aprovação).',
    });
  };
  const novoFornecedor = () => abrir({ titulo: 'Novo fornecedor', campos: camposFornecedor, valoresIniciais: { ativo: true }, acao: (v) => salvarFornecedor(null, v), sucesso: 'Fornecedor cadastrado.' });
  const editarFornecedor = (f: Fornecedor) => abrir({
    titulo: 'Editar fornecedor', campos: camposFornecedor,
    valoresIniciais: { nome: f.nome, documento: f.documento, telefone: f.telefone ?? '', email: f.email ?? '', codigoBanco: f.codigo_banco ?? '', agencia: f.agencia ?? '', conta: f.conta ?? '', digito: f.digito ?? '', tipoConta: f.tipo_conta ?? '', tipoPix: f.tipo_pix ?? '', chavePix: f.chave_pix ?? '', ativo: !!f.ativo, observacao: f.observacao ?? '' },
    acao: (v) => salvarFornecedor(f.id, v), sucesso: 'Fornecedor atualizado.',
  });

  const abrirConta = async (id: number) => {
    if (aberta?.conta.id === id) { setAberta(null); return; }
    try { setAberta(await obterContaPagar(id)); } catch (err: any) { showToast(err?.message || 'Erro.', 'error'); }
  };

  return (
    <>
      <div className="monitoramento-table-card">
        <div className="table-card-header">
          <div>
            <h3 className="table-card-title">Contas a pagar</h3>
            <p style={{ margin: '4px 0 0 0', fontSize: 13, color: '#64748b' }}>Aguardando aprovação → aprovada → programada → paga (baixa com comprovante). DDA não faz parte deste módulo.</p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {visao === 'contas' && (
              <select className="filter-select" value={filtro} onChange={(e) => setFiltro(e.target.value)}>
                <option value="aguardando_aprovacao,aprovada,programada,rejeitada">Em aberto</option>
                <option value="aguardando_aprovacao">Aguardando aprovação</option>
                <option value="programada">Programadas</option>
                <option value="vencidas">Vencidas</option>
                <option value="paga">Pagas</option>
                <option value="cancelada">Canceladas</option>
                <option value="">Todas</option>
              </select>
            )}
            {visao === 'fornecedores' && <button type="button" className="btn-secondary-filter" onClick={novoFornecedor}>+ Fornecedor</button>}
            {visao === 'categorias' && <button type="button" className="btn-secondary-filter" onClick={() => abrir({ titulo: 'Nova categoria', campos: [{ nome: 'nome', rotulo: 'Nome', obrigatorio: true }], acao: (v) => salvarCategoriaConta(null, v), sucesso: 'Categoria cadastrada.' })}>+ Categoria</button>}
            <button type="button" className="btn-primary-filter" onClick={() => novaConta()}>+ Nova conta</button>
          </div>
        </div>

        <div className="monitoramento-tabs-nav" style={{ margin: '0 24px' }}>
          {([['contas', `Contas (${contas.length})`], ['fornecedores', `Fornecedores (${fornecedores.length})`], ['categorias', `Categorias (${categorias.length})`]] as const).map(([id, rotulo]) => (
            <button key={id} type="button" className={`monitoramento-tab-btn ${visao === id ? 'active' : ''}`} onClick={() => setVisao(id)}>{rotulo}</button>
          ))}
        </div>

        {visao === 'fornecedores' && (
          <div className="table-responsive">
            <table className="monitoramento-table" style={{ fontSize: 12 }}>
              <thead><tr><th>Código</th><th>Fornecedor</th><th>Descrição / categoria</th><th>Documento</th><th>Competência</th><th>Vencimento</th><th style={{ textAlign: 'right' }}>Valor</th><th>Situação</th><th /></tr></thead>
              <tbody>
                {fornecedores.length === 0 ? <tr><td colSpan={9} style={{ textAlign: 'center', padding: 24, color: '#94a3b8' }}>Nenhum fornecedor cadastrado.</td></tr>
                  : fornecedores.map((f) => (
                    <tr key={f.id} style={{ opacity: f.ativo ? 1 : 0.6 }}>
                      <td><strong>FOR-{String(f.id).padStart(6, '0')}</strong></td>
                      <td>{f.nome}{(f.telefone || f.email) && <div style={{ color: '#64748b' }}>{[f.telefone && formatarTelefone(f.telefone), f.email].filter(Boolean).join(' · ')}</div>}</td>
                      <td>{f.observacao ?? '—'}<div style={{ color: '#64748b' }}>{Number(f.contas_abertas) ? `${f.contas_abertas} conta(s) em aberto` : 'Sem contas em aberto'}</div></td>
                      <td>{mascaraDocumento(f.documento)}{f.conta && <div style={{ color: '#64748b' }}>{f.codigo_banco} ag {f.agencia} cc {f.conta}-{f.digito}</div>}{f.chave_pix && <div style={{ color: '#64748b' }}>PIX {f.tipo_pix}: {f.chave_pix}</div>}</td>
                      <td>{f.ultima_competencia ?? '—'}</td>
                      <td>{f.proximo_vencimento ? formatarDataBR(f.proximo_vencimento) : '—'}</td>
                      <td style={{ textAlign: 'right' }}>{moeda(f.valor_aberto)}</td>
                      <td><span className={`badge-status ${f.ativo ? 'badge-ativo' : 'badge-inativo'}`}><span className="badge-status-dot" />{f.ativo ? 'Ativo' : 'Inativo'}</span></td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {!!f.ativo && <button type="button" className="btn-action-view" onClick={() => novaConta(f.id)}>+ Conta</button>}{' '}
                        <button type="button" className="btn-action-edit" onClick={() => editarFornecedor(f)}>Editar</button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
            <p style={{ margin: 0, padding: '10px 24px', fontSize: 12, color: '#64748b' }}>Competência, vencimento e valor vêm das contas em aberto do fornecedor. Use "+ Conta" para lançar uma conta; ela aparece na aba Contas.</p>
          </div>
        )}

        {visao === 'categorias' && (
          <div className="table-responsive">
            <table className="monitoramento-table" style={{ fontSize: 12 }}>
              <thead><tr><th>Categoria</th><th>Situação</th><th /></tr></thead>
              <tbody>
                {categorias.length === 0 ? <tr><td colSpan={3} style={{ textAlign: 'center', padding: 24, color: '#94a3b8' }}>Nenhuma categoria cadastrada.</td></tr>
                  : categorias.map((c) => (
                    <tr key={c.id} style={{ opacity: c.ativa ? 1 : 0.6 }}>
                      <td>{c.nome}</td>
                      <td><span className={`badge-status ${c.ativa ? 'badge-ativo' : 'badge-inativo'}`}><span className="badge-status-dot" />{c.ativa ? 'Ativa' : 'Inativa'}</span></td>
                      <td><button type="button" className="btn-action-edit" onClick={() => abrir({
                        titulo: 'Editar categoria', campos: [{ nome: 'nome', rotulo: 'Nome', obrigatorio: true }, { nome: 'ativa', rotulo: 'Situação', tipo: 'checkbox', placeholder: 'Ativa' }],
                        valoresIniciais: { nome: c.nome, ativa: !!c.ativa }, acao: (v) => salvarCategoriaConta(c.id, v), sucesso: 'Categoria atualizada.',
                      })}>Editar</button></td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}

        {visao === 'contas' && (
        <div className="table-responsive">
          <table className="monitoramento-table" style={{ fontSize: 12 }}>
            <thead><tr><th>Código</th><th>Fornecedor</th><th>Descrição / categoria</th><th>Documento</th><th>Competência</th><th>Vencimento</th><th style={{ textAlign: 'right' }}>Valor</th><th>Situação</th><th /></tr></thead>
            <tbody>
              {contas.length === 0 ? <tr><td colSpan={9} style={{ textAlign: 'center', padding: 24, color: '#94a3b8' }}>Nenhuma conta.</td></tr>
                : contas.map((c) => (
                  <React.Fragment key={c.id}>
                    <tr style={{ background: aberta?.conta.id === c.id ? '#f0fdf4' : undefined }}>
                      <td><button type="button" style={{ border: 'none', background: 'none', color: '#2563eb', cursor: 'pointer', padding: 0, fontWeight: 600 }} onClick={() => abrirConta(c.id)}>{c.codigo}</button></td>
                      <td>{c.fornecedor_nome}</td>
                      <td>{c.descricao}<div style={{ color: '#64748b' }}>{c.categoria_nome}</div></td>
                      <td>{TIPOS_DOC.find((t) => t.valor === c.documento_tipo)?.rotulo} {c.documento_numero ?? ''}</td>
                      <td>{c.competencia}</td>
                      <td style={{ color: c.vencida ? '#b91c1c' : undefined }}>{formatarDataBR(c.vencimento)}{c.vencida ? ' (vencida)' : ''}{c.data_programada && <div style={{ color: '#64748b' }}>programada {formatarDataBR(c.data_programada)}</div>}</td>
                      <td style={{ textAlign: 'right' }}>{moeda(c.valor)}{c.valor_pago && <div style={{ color: '#64748b' }}>pago {moeda(c.valor_pago)}</div>}</td>
                      <td><span className={`badge-status ${SITUACAO[c.situacao][1]}`}><span className="badge-status-dot" />{SITUACAO[c.situacao][0]}</span>{c.motivo_situacao && <div style={{ color: '#64748b' }}>{c.motivo_situacao}</div>}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {['aguardando_aprovacao', 'rejeitada'].includes(c.situacao) && <button type="button" className="btn-action-edit" onClick={() => abrir({
                          titulo: `Editar ${c.codigo}`, campos: camposConta,
                          valoresIniciais: { fornecedorId: c.fornecedor_id, categoriaId: c.categoria_id, competencia: c.competencia, descricao: c.descricao, valor: dec(c.valor), vencimento: c.vencimento.slice(0, 10), documentoTipo: c.documento_tipo, documentoNumero: c.documento_numero ?? '', documentoEmissao: c.documento_emissao?.slice(0, 10) ?? '', observacao: c.observacao ?? '' },
                          acao: (v) => atualizarContaPagar(c.id, v), sucesso: c.situacao === 'rejeitada' ? 'Corrigida e reenviada para aprovação.' : 'Conta atualizada.',
                        })}>Editar</button>}{' '}
                        {podeAprovar && c.situacao === 'aguardando_aprovacao' && <button type="button" className="btn-action-view" onClick={() => window.confirm(`Aprovar ${c.codigo} (${moeda(c.valor)})?`) && aprovarContaPagar(c.id).then(() => { showToast('Conta aprovada.', 'success'); carregar(); }).catch((e) => showToast(e?.message || 'Erro.', 'error'))}>Aprovar</button>}{' '}
                        {podeAprovar && ['aguardando_aprovacao', 'aprovada', 'programada'].includes(c.situacao) && <button type="button" className="btn-action-obs" onClick={() => pedirMotivo(`Rejeitar ${c.codigo}`, (m) => rejeitarContaPagar(c.id, m), 'Conta rejeitada.')}>Rejeitar</button>}{' '}
                        {['aprovada', 'programada'].includes(c.situacao) && (
                          <>
                            <button type="button" className="btn-action-edit" onClick={() => abrir({
                              titulo: `Programar ${c.codigo}`,
                              campos: [{ nome: 'dataProgramada', rotulo: 'Data programada', tipo: 'data', obrigatorio: true }, { nome: 'formaPagamento', rotulo: 'Forma de pagamento', tipo: 'select', obrigatorio: true, opcoes: FORMAS }],
                              valoresIniciais: { dataProgramada: c.data_programada?.slice(0, 10) ?? c.vencimento.slice(0, 10), formaPagamento: c.forma_pagamento ?? 'boleto' },
                              acao: async (v) => { const r = await programarContaPagar(c.id, v); if (r.aviso) showToast(r.aviso, 'warning'); }, sucesso: 'Pagamento programado.',
                            })}>Programar</button>{' '}
                            <button type="button" className="btn-action-view" onClick={() => abrir({
                              titulo: `Baixa de ${c.codigo}`, descricao: `Valor do documento: ${moeda(c.valor)}. O valor pago deve ser igual a valor + juros + multa − desconto.`,
                              campos: [
                                { nome: 'dataPagamento', rotulo: 'Data do pagamento', tipo: 'data', obrigatorio: true, largura: 'metade' },
                                { nome: 'formaPagamento', rotulo: 'Forma', tipo: 'select', largura: 'metade', opcoes: FORMAS },
                                { nome: 'juros', rotulo: 'Juros', tipo: 'numero', largura: 'metade' },
                                { nome: 'multa', rotulo: 'Multa', tipo: 'numero', largura: 'metade' },
                                { nome: 'desconto', rotulo: 'Desconto', tipo: 'numero', largura: 'metade' },
                                { nome: 'valorPago', rotulo: 'Valor pago', tipo: 'numero', obrigatorio: true, largura: 'metade' },
                                { nome: 'comprovante', rotulo: 'Comprovante', tipo: 'arquivo', aceitar: '.pdf,.png,.jpg,.jpeg' },
                                { nome: 'observacao', rotulo: 'Observação', tipo: 'textarea' },
                              ],
                              valoresIniciais: { dataPagamento: dataLocalISO(), formaPagamento: c.forma_pagamento ?? '', valorPago: dec(c.valor) },
                              acao: (v) => baixarContaPagar(c.id, { ...v, comprovante: v.comprovante || undefined }), sucesso: 'Baixa registrada.',
                            })}>Baixar</button>{' '}
                          </>
                        )}
                        {podeAprovar && c.situacao === 'paga' && <button type="button" className="btn-action-obs" onClick={() => pedirMotivo(`Estornar baixa de ${c.codigo}`, (m) => estornarBaixaContaPagar(c.id, m), 'Baixa estornada.')}>Estornar baixa</button>}
                        {!['paga', 'cancelada'].includes(c.situacao) && <button type="button" className="btn-action-obs" onClick={() => pedirMotivo(`Cancelar ${c.codigo}`, (m) => cancelarContaPagar(c.id, m), 'Conta cancelada.')}>Cancelar</button>}
                      </td>
                    </tr>
                    {aberta?.conta.id === c.id && (
                      <tr><td colSpan={9} style={{ background: '#f8fafc', fontSize: 12 }}>
                        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                          <div>
                            <strong>Responsáveis:</strong> lançada por {c.criado_por_nome ?? '—'}{c.aprovado_por_nome && ` · aprovada por ${c.aprovado_por_nome}`}
                            {c.programado_por_nome && ` · programada por ${c.programado_por_nome}`}{c.baixado_por_nome && ` · baixa por ${c.baixado_por_nome}`}
                            <div style={{ marginTop: 6 }}><strong>Anexos:</strong>{' '}
                              {aberta.anexos.map((a) => (
                                <button key={a.id} type="button" style={{ border: 'none', background: 'none', color: '#2563eb', cursor: 'pointer' }}
                                  onClick={() => baixarDocumentoFinanceiro(a.id, a.nome_arquivo).catch((e) => showToast(e?.message || 'Erro.', 'error'))}>⬇ {a.nome_arquivo} ({a.tipo})</button>
                              ))}
                              {c.situacao !== 'cancelada' && <button type="button" className="btn-action-edit" onClick={() => abrir({
                                titulo: 'Anexar documento',
                                campos: [
                                  { nome: 'tipo', rotulo: 'Tipo', tipo: 'select', obrigatorio: true, opcoes: [{ valor: 'documento_fiscal', rotulo: 'Documento fiscal' }, { valor: 'boleto', rotulo: 'Boleto' }, { valor: 'comprovante', rotulo: 'Comprovante' }, { valor: 'outro', rotulo: 'Outro' }] },
                                  { nome: 'arquivo', rotulo: 'Arquivo (PDF, XML ou imagem, até 3 MB)', tipo: 'arquivo', obrigatorio: true, aceitar: '.pdf,.xml,.png,.jpg,.jpeg' },
                                ],
                                valoresIniciais: { tipo: 'documento_fiscal' }, acao: (v) => anexarDocumentoContaPagar(c.id, v.tipo, v.arquivo), sucesso: 'Documento anexado.',
                              })}>+ Anexo</button>}
                            </div>
                          </div>
                          <div style={{ flex: 1, minWidth: 280 }}>
                            <strong>Histórico</strong>
                            {aberta.historico.map((h) => (
                              <div key={h.id}>{new Date(h.criado_em.replace(' ', 'T')).toLocaleString('pt-BR')} · {h.usuario_nome} · {h.acao}{h.campo ? ` (${h.campo}: ${h.valor_anterior ?? '—'} → ${h.valor_novo ?? '—'})` : ''}{h.motivo ? ` · ${h.motivo}` : ''}</div>
                            ))}
                          </div>
                        </div>
                      </td></tr>
                    )}
                  </React.Fragment>
                ))}
            </tbody>
          </table>
        </div>
        )}
      </div>
      {modal && <ModalFormulario {...modal} />}
    </>
  );
};

export default ContasPagar;
