import React, { useEffect, useState } from 'react';
import './Monitoramento.css';
import { useToast } from '../../../components/ToastContext';
import { dataLocalISO, formatarDataHora } from '../../../utils/formatters';
import { rotuloTipoUsuario, TipoUsuario } from '../../../api/usuariosApi';
import {
  EtapaFechamento, Fechamento, HistoricoFechamento, concluirFechamento, decidirReabertura, iniciarFechamento,
  listarFechamentos, obterHistoricoFechamento, solicitarReabertura,
} from '../../../api/escalaFaturamentoApi';
import ModalFormulario from '../financeiro/ModalFormulario';

const ETAPA: Record<EtapaFechamento, [string, string]> = {
  aberto: ['Aberto', 'badge-ativo'],
  supervisao: ['Em fechamento (Supervisão)', 'badge-pendente'],
  faturamento: ['Com o Faturamento', 'badge-em-atividade'],
};
const ACAO: Record<string, string> = {
  inicio: 'Fechamento iniciado',
  conclusao: 'Concluído e encaminhado ao Faturamento',
  reabertura_solicitada: 'Reabertura solicitada',
  reabertura_liberada: 'Reabertura liberada',
  reabertura_recusada: 'Reabertura recusada',
};
const perfil = (p: string | null) => (p ? rotuloTipoUsuario(p as TipoUsuario) : '—');
const CAMPO_JUSTIFICATIVA = { nome: 'justificativa', rotulo: 'Justificativa', tipo: 'textarea' as const, obrigatorio: true, ajuda: 'Mínimo de 10 caracteres. Fica registrada no histórico.' };

interface Props {
  /** Fixa a competência e o cliente quando o painel está dentro de outra tela (ex.: Jornadas). */
  competencia?: string;
  empresaId?: number;
}

/** Etapas do fechamento por cliente × competência: quem pode alterar e pedidos de reabertura. */
export const PainelFechamento: React.FC<Props> = ({ competencia: competenciaFixa, empresaId }) => {
  const { showToast } = useToast();
  const [competenciaLocal, setCompetenciaLocal] = useState(dataLocalISO().slice(0, 7));
  const competencia = competenciaFixa ?? competenciaLocal;
  const [fechamentos, setFechamentos] = useState<Fechamento[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [modal, setModal] = useState<React.ComponentProps<typeof ModalFormulario> | null>(null);
  const [historico, setHistorico] = useState<{ empresaId: number; itens: HistoricoFechamento[] } | null>(null);

  const carregar = async () => {
    setCarregando(true);
    try { setFechamentos(await listarFechamentos(competencia)); }
    catch (err: any) { showToast(err?.message || 'Erro ao carregar os fechamentos.', 'error'); }
    finally { setCarregando(false); }
  };
  useEffect(() => { carregar(); setHistorico(null); }, [competencia]);

  const linhas = empresaId ? fechamentos.filter((f) => f.empresa_id === empresaId) : fechamentos;
  const pendentes = linhas.filter((f) => f.acoes.decidir).length;

  const executar = async (acao: () => Promise<unknown>, sucesso: string) => {
    setOcupado(true);
    try { await acao(); showToast(sucesso, 'success'); await carregar(); }
    catch (err: any) { showToast(err?.message || 'Não foi possível concluir a ação.', 'error'); }
    finally { setOcupado(false); }
  };

  const abrir = (titulo: string, descricao: string, rotuloConfirmar: string, acao: (justificativa: string) => Promise<unknown>, sucesso: string) => setModal({
    titulo, descricao, rotuloConfirmar, campos: [CAMPO_JUSTIFICATIVA],
    onConfirmar: async (v) => { await acao(v.justificativa); showToast(sucesso, 'success'); await carregar(); },
    onClose: () => setModal(null),
  });

  const verHistorico = async (f: Fechamento) => {
    if (historico?.empresaId === f.empresa_id) { setHistorico(null); return; }
    try { setHistorico({ empresaId: f.empresa_id, itens: await obterHistoricoFechamento(f.empresa_id, competencia) }); }
    catch (err: any) { showToast(err?.message || 'Erro ao carregar o histórico.', 'error'); }
  };

  const chave = (f: Fechamento) => ({ empresaId: f.empresa_id, competencia });

  return (
    <div className="monitoramento-table-card">
      <div className="table-card-header">
        <div>
          <h3 className="table-card-title">
            Fechamento {pendentes > 0 && <span className="badge-status badge-divergente" style={{ marginLeft: 8 }}>{pendentes} reabertura(s) para decidir</span>}
          </h3>
          <p style={{ margin: '4px 0 0 0', fontSize: 13, color: '#64748b' }}>
            Ao iniciar o fechamento, só o supervisor altera escalas e horários. Depois de encaminhado ao Faturamento, ninguém altera.
            Para corrigir, solicite a reabertura ao responsável pela etapa seguinte.
          </p>
        </div>
        {!competenciaFixa && <input type="month" className="filter-input" value={competencia} onChange={(e) => e.target.value && setCompetenciaLocal(e.target.value)} aria-label="Competência" />}
      </div>
      <div className="table-responsive">
        <table className="monitoramento-table" style={{ fontSize: 12.5 }}>
          <thead><tr><th>Cliente</th><th>Etapa</th><th>Responsáveis</th><th>Reabertura</th><th /></tr></thead>
          <tbody>
            {linhas.length === 0 ? (
              <tr><td colSpan={5} style={{ textAlign: 'center', padding: 24, color: '#94a3b8' }}>{carregando ? 'Carregando...' : 'Nenhum cliente com operação nesta competência.'}</td></tr>
            ) : linhas.map((f) => (
              <React.Fragment key={f.empresa_id}>
                <tr>
                  <td><strong>{f.nome_empresa}</strong></td>
                  <td><span className={`badge-status ${ETAPA[f.etapa][1]}`}><span className="badge-status-dot" />{ETAPA[f.etapa][0]}</span></td>
                  <td style={{ color: '#64748b' }}>
                    {f.etapa !== 'aberto' && f.iniciado_por_nome && <div>Iniciado por {f.iniciado_por_nome} em {formatarDataHora(f.iniciado_em)}</div>}
                    {f.etapa === 'faturamento' && f.concluido_por_nome && <div>Encaminhado por {f.concluido_por_nome} em {formatarDataHora(f.concluido_em)}</div>}
                  </td>
                  <td style={{ maxWidth: 280 }}>
                    {f.reabertura_id ? (
                      <>
                        <strong style={{ color: '#92400e' }}>Solicitada por {f.reabertura_por_nome} ({perfil(f.reabertura_por_perfil)})</strong>
                        <div style={{ color: '#64748b' }}>{f.reabertura_justificativa}</div>
                        <div style={{ color: '#64748b' }}>Aguardando {f.etapa === 'faturamento' ? 'o Faturamento' : 'a Supervisão'}.</div>
                      </>
                    ) : '—'}
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {f.acoes.iniciar && <button type="button" className="btn-action-view" disabled={ocupado} onClick={() => window.confirm(`Iniciar o fechamento de ${f.nome_empresa}? Só o supervisor poderá alterar escalas e horários desta competência.`) && executar(() => iniciarFechamento(chave(f)), 'Fechamento iniciado.')}>Iniciar fechamento</button>}{' '}
                    {f.acoes.concluir && <button type="button" className="btn-action-view" disabled={ocupado} onClick={() => window.confirm(`Encaminhar ${f.nome_empresa} ao Faturamento? A Supervisão não poderá mais alterar esta competência.`) && executar(() => concluirFechamento(chave(f)), 'Encaminhado ao Faturamento.')}>Concluir e enviar ao Faturamento</button>}{' '}
                    {f.acoes.solicitar && <button type="button" className="btn-action-edit" disabled={ocupado} onClick={() => abrir(`Solicitar reabertura — ${f.nome_empresa}`, `O pedido vai para ${f.etapa === 'faturamento' ? 'o Faturamento' : 'a Supervisão'}, que decide se libera a edição.`, 'Enviar solicitação', (j) => solicitarReabertura({ ...chave(f), justificativa: j }), 'Solicitação enviada.')}>Solicitar reabertura</button>}{' '}
                    {f.acoes.decidir && (
                      <>
                        <button type="button" className="btn-action-view" disabled={ocupado} onClick={() => abrir(`Liberar reabertura — ${f.nome_empresa}`, `Motivo do pedido: ${f.reabertura_justificativa}`, 'Liberar para edição', async (j) => { const r = await decidirReabertura({ ...chave(f), liberar: true, justificativa: j }); if (r.aviso) showToast(r.aviso, 'warning'); }, 'Reabertura liberada.')}>Liberar</button>{' '}
                        <button type="button" className="btn-action-obs" disabled={ocupado} onClick={() => abrir(`Recusar reabertura — ${f.nome_empresa}`, `Motivo do pedido: ${f.reabertura_justificativa}`, 'Recusar', (j) => decidirReabertura({ ...chave(f), liberar: false, justificativa: j }), 'Reabertura recusada.')}>Recusar</button>{' '}
                      </>
                    )}
                    <button type="button" className="btn-action-edit" onClick={() => verHistorico(f)}>Histórico</button>
                  </td>
                </tr>
                {historico?.empresaId === f.empresa_id && (
                  <tr><td colSpan={5} style={{ background: '#f8fafc' }}>
                    {historico.itens.length === 0 ? <span style={{ color: '#94a3b8' }}>Sem movimentações.</span> : historico.itens.map((h) => (
                      <div key={h.id} style={{ padding: '2px 0' }}>{formatarDataHora(h.criado_em)} · <strong>{h.usuario_nome}</strong> ({perfil(h.usuario_perfil)}) · {ACAO[h.acao] ?? h.acao}{h.justificativa ? ` · ${h.justificativa}` : ''}</div>
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

export default PainelFechamento;
