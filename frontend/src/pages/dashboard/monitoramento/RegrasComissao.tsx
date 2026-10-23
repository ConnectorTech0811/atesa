import React, { useEffect, useState } from 'react';
import './Monitoramento.css';
import { useToast } from '../../../components/ToastContext';
import { formatarDataBR } from '../../../utils/formatters';
import {
  AuditoriaFinanceira, OpcoesComissao, RegraComissao, atualizarRegraComissao, confirmarRegraComissao, criarRegraComissao,
  inativarRegraComissao, listarAuditoriaFaturamentoFinanceira, listarRegrasComissao, obterOpcoesComissao,
} from '../../../api/financeiroApi';
import ModalFormulario, { CampoFormulario, ValoresFormulario } from '../financeiro/ModalFormulario';

interface Props {
  empresas: { id: number; nome_empresa: string }[];
}

export const RegrasComissao: React.FC<Props> = ({ empresas }) => {
  const { showToast } = useToast();
  const [regras, setRegras] = useState<RegraComissao[]>([]);
  const [opcoes, setOpcoes] = useState<OpcoesComissao | null>(null);
  const [inativas, setInativas] = useState(false);
  const [modal, setModal] = useState<React.ComponentProps<typeof ModalFormulario> | null>(null);
  const [historico, setHistorico] = useState<{ regraId: number; linhas: AuditoriaFinanceira[] } | null>(null);

  const carregar = async () => {
    try { setRegras(await listarRegrasComissao(inativas)); }
    catch (err: any) { showToast(err?.message || 'Erro ao listar regras.', 'error'); }
  };
  useEffect(() => { carregar(); }, [inativas]);
  useEffect(() => { obterOpcoesComissao().then(setOpcoes).catch((e) => showToast(e?.message || 'Erro ao carregar opções.', 'error')); }, []);

  const abrir = (titulo: string, campos: CampoFormulario[], acao: (v: ValoresFormulario) => Promise<unknown>, sucesso: string, valoresIniciais?: ValoresFormulario, descricao?: React.ReactNode) =>
    setModal({
      titulo, campos, valoresIniciais, descricao,
      onConfirmar: async (v) => { await acao(v); showToast(sucesso, 'success'); await carregar(); },
      onClose: () => setModal(null),
    });

  const camposRegra = (confirmada: boolean): CampoFormulario[] => {
    if (confirmada) {
      return [
        { nome: 'vigenciaFim', rotulo: 'Fim da vigência', tipo: 'data', ajuda: 'Regra confirmada: para mudar percentual, base ou escopo, encerre a vigência e cadastre uma nova.' },
        { nome: 'observacao', rotulo: 'Observação', tipo: 'textarea' },
      ];
    }
    return [
      { nome: 'papel', rotulo: 'Papel', tipo: 'select', obrigatorio: true, largura: 'metade', opcoes: [{ valor: 'consultor', rotulo: 'Consultor' }, { valor: 'executivo', rotulo: 'Executivo de contas' }] },
      { nome: 'percentual', rotulo: 'Percentual (%)', tipo: 'numero', obrigatorio: true, largura: 'metade', placeholder: 'Ex: 2,5' },
      { nome: 'usuarioId', rotulo: 'Usuário', tipo: 'select', largura: 'metade', opcoes: (opcoes?.usuarios ?? []).map((u) => ({ valor: u.id, rotulo: u.nome })), ajuda: 'Vazio = todos do papel.' },
      { nome: 'empresaId', rotulo: 'Cliente', tipo: 'select', largura: 'metade', opcoes: empresas.map((e) => ({ valor: e.id, rotulo: e.nome_empresa })), ajuda: 'Vazio = todos os clientes.' },
      { nome: 'baseCalculo', rotulo: 'Base de cálculo', tipo: 'select', obrigatorio: true, opcoes: Object.entries(opcoes?.bases ?? {}).map(([valor, rotulo]) => ({ valor, rotulo })) },
      { nome: 'referenciaVigencia', rotulo: 'Data usada para a vigência', tipo: 'select', obrigatorio: true, opcoes: Object.entries(opcoes?.referencias ?? {}).map(([valor, rotulo]) => ({ valor, rotulo })) },
      { nome: 'vigenciaInicio', rotulo: 'Início da vigência', tipo: 'data', obrigatorio: true, largura: 'metade' },
      { nome: 'vigenciaFim', rotulo: 'Fim da vigência', tipo: 'data', largura: 'metade' },
      { nome: 'observacao', rotulo: 'Observação', tipo: 'textarea' },
    ];
  };

  const verHistorico = async (regraId: number) => {
    if (historico?.regraId === regraId) { setHistorico(null); return; }
    try { setHistorico({ regraId, linhas: await listarAuditoriaFaturamentoFinanceira({ entidade: 'comissao_regra', entidadeId: regraId }) }); }
    catch (err: any) { showToast(err?.message || 'Erro ao carregar histórico.', 'error'); }
  };

  return (
    <div className="monitoramento-table-card">
      <div className="table-card-header">
        <div>
          <h3 className="table-card-title">Regras de comissão — consultores e executivos</h3>
          <p style={{ margin: '4px 0 0 0', fontSize: 13, color: '#64748b' }}>
            Cada regra define percentual, vigência e abrangência (usuário e/ou cliente; vale a mais específica).
            A regra só gera valor depois de <strong>confirmada</strong>, com a referência da decisão da ATESA. A regra de pagamento das comissões ainda não foi definida e não é executada pelo sistema.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <label style={{ fontSize: 13, display: 'flex', gap: 6, alignItems: 'center' }}>
            <input type="checkbox" checked={inativas} onChange={(e) => setInativas(e.target.checked)} /> Mostrar inativas
          </label>
          <button type="button" className="btn-primary-filter" disabled={!opcoes} onClick={() => abrir('Nova regra de comissão', camposRegra(false),
            (v) => criarRegraComissao(v), 'Regra cadastrada (aguardando confirmação).',
            { papel: 'consultor', baseCalculo: 'nao_definida', referenciaVigencia: 'nao_definida' },
            'Use "Não definida" enquanto a ATESA não confirmar a base de cálculo: a regra fica registrada, mas não calcula.')}>+ Nova regra</button>
        </div>
      </div>
      <div className="table-responsive">
        <table className="monitoramento-table" style={{ fontSize: 12 }}>
          <thead><tr><th>#</th><th>Papel</th><th>Usuário</th><th>Cliente</th><th style={{ textAlign: 'right' }}>%</th><th>Base</th><th>Vigência</th><th>Situação</th><th /></tr></thead>
          <tbody>
            {regras.length === 0 ? (
              <tr><td colSpan={9} style={{ textAlign: 'center', padding: 24, color: '#94a3b8' }}>Nenhuma regra cadastrada.</td></tr>
            ) : regras.map((r) => (
              <React.Fragment key={r.id}>
                <tr style={{ opacity: Number(r.ativa) ? 1 : 0.55 }}>
                  <td>{r.id}</td>
                  <td>{r.papel === 'consultor' ? 'Consultor' : 'Executivo'}</td>
                  <td>{r.usuario_nome ?? 'Todos'}</td>
                  <td>{r.nome_empresa ?? 'Todos'}</td>
                  <td style={{ textAlign: 'right' }}>{Number(r.percentual).toLocaleString('pt-BR')}</td>
                  <td>{opcoes?.bases[r.base_calculo] ?? r.base_calculo}<div style={{ color: '#64748b' }}>Vigência por: {opcoes?.referencias[r.referencia_vigencia] ?? r.referencia_vigencia}</div></td>
                  <td style={{ whiteSpace: 'nowrap' }}>{formatarDataBR(r.vigencia_inicio)} a {r.vigencia_fim ? formatarDataBR(r.vigencia_fim) : 'indeterminado'}</td>
                  <td>
                    {!Number(r.ativa) ? <span className="badge-status badge-inativo"><span className="badge-status-dot" />Inativa</span>
                      : Number(r.confirmada) ? <span className="badge-status badge-em-atividade" title={r.confirmacao_referencia ?? ''}><span className="badge-status-dot" />Confirmada</span>
                        : <span className="badge-status badge-pendente"><span className="badge-status-dot" />Aguardando confirmação</span>}
                    {Number(r.confirmada) ? <div style={{ color: '#64748b' }}>{r.confirmacao_referencia} · {r.confirmada_por_nome}</div> : null}
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {Number(r.ativa) ? (
                      <>
                        <button type="button" className="btn-action-edit" onClick={() => abrir(`Editar regra #${r.id}`, camposRegra(!!Number(r.confirmada)), (v) => atualizarRegraComissao(r.id, v), 'Regra atualizada.', {
                          papel: r.papel, percentual: String(Number(r.percentual)).replace('.', ','), usuarioId: r.usuario_id ?? '', empresaId: r.empresa_id ?? '',
                          baseCalculo: r.base_calculo, referenciaVigencia: r.referencia_vigencia, vigenciaInicio: r.vigencia_inicio.slice(0, 10),
                          vigenciaFim: r.vigencia_fim?.slice(0, 10) ?? '', observacao: r.observacao ?? '',
                        })}>Editar</button>{' '}
                        {!Number(r.confirmada) && (
                          <button type="button" className="btn-action-view" onClick={() => abrir(`Confirmar regra #${r.id}`, [
                            { nome: 'confirmacaoReferencia', rotulo: 'Referência da confirmação da ATESA', obrigatorio: true, placeholder: 'Ex.: e-mail da diretoria de 20/10/2026' },
                          ], (v) => confirmarRegraComissao(r.id, v.confirmacaoReferencia), 'Regra confirmada.', undefined,
                          `${Number(r.percentual).toLocaleString('pt-BR')}% sobre "${opcoes?.bases[r.base_calculo]}". Depois de confirmada, percentual, base e escopo não podem mais ser alterados.`)}>Confirmar</button>
                        )}{' '}
                        <button type="button" className="btn-action-obs" onClick={() => abrir(`Inativar regra #${r.id}`, [{ nome: 'motivo', rotulo: 'Motivo', tipo: 'textarea', obrigatorio: true }],
                          (v) => inativarRegraComissao(r.id, v.motivo), 'Regra inativada.')}>Inativar</button>{' '}
                      </>
                    ) : null}
                    <button type="button" className="btn-action-view" onClick={() => verHistorico(r.id)}>Histórico</button>
                  </td>
                </tr>
                {historico?.regraId === r.id && (
                  <tr><td colSpan={9} style={{ background: '#f8fafc' }}>
                    {historico.linhas.map((h) => (
                      <div key={h.id} style={{ fontSize: 12, padding: '2px 0' }}>
                        {new Date(h.criado_em.replace(' ', 'T')).toLocaleString('pt-BR')} · <strong>{h.usuario_nome}</strong> · {h.acao}{h.campo ? ` (${h.campo})` : ''}
                        {h.valor_anterior || h.valor_novo ? `: ${h.valor_anterior ?? '—'} → ${h.valor_novo ?? '—'}` : ''}{h.motivo ? ` · ${h.motivo}` : ''}
                      </div>
                    ))}
                  </td></tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
      {modal && <ModalFormulario {...modal} />}
    </div>
  );
};

export default RegrasComissao;
