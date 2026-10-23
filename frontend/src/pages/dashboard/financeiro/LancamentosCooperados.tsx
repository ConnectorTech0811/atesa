import React, { useEffect, useState } from 'react';
import '../monitoramento/Monitoramento.css';
import { useToast } from '../../../components/ToastContext';
import { dataLocalISO, formatarMoeda } from '../../../utils/formatters';
import {
  Bloqueio, CooperadoBusca, ErroComDetalhes, ItemPrevia, Lancamento, adiarCompensacao, bloquearPagamentos, buscarCooperados, cancelarLancamento,
  criarLancamentoManual, encerrarBloqueio, estornarLancamento, gerarLancamentos, listarBloqueios, listarLancamentosCooperados, previaLancamentos,
  registrarAdiantamento,
} from '../../../api/financeiroApi';
import ModalFormulario, { ValoresFormulario } from './ModalFormulario';

const competenciaAnterior = (() => {
  const [a, m] = dataLocalISO().split('-').map(Number);
  const d = new Date(a, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
})();

const ROTULO_PREVIA: Record<ItemPrevia['situacao'], [string, string]> = {
  novo: ['A lançar', 'badge-ativo'],
  requer_confirmacao: ['Confirmar regra', 'badge-pendente'],
  regra_pendente: ['Regra não definida', 'badge-inativo'],
  ja_lancado: ['Já lançado', 'badge-em-atividade'],
  valor_diferente: ['Valor mudou', 'badge-divergente'],
};
const ROTULO_SITUACAO: Record<string, string> = {
  aguardando: 'Aguardando adiantamento ser pago', pendente: 'Pendente', reservado: 'No pagamento', liquidado: 'Liquidado', cancelado: 'Cancelado',
};
const ROTULO_STATUS_COOP: Record<number, string> = { 1: 'ativo', 2: 'inativo', 4: 'desligado' };
const moeda = (v: string | number | null) => (v === null ? '—' : formatarMoeda(Number(v)));

export const LancamentosCooperados: React.FC = () => {
  const { showToast } = useToast();
  const [competencia, setCompetencia] = useState(competenciaAnterior);
  const [previa, setPrevia] = useState<{ itens: ItemPrevia[]; avisos: string[] } | null>(null);
  const [marcadas, setMarcadas] = useState<Set<string>>(new Set());
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [soAbertos, setSoAbertos] = useState(true);
  const [bloqueios, setBloqueios] = useState<Bloqueio[]>([]);
  const [cooperados, setCooperados] = useState<CooperadoBusca[]>([]);
  const [modal, setModal] = useState<React.ComponentProps<typeof ModalFormulario> | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const carregar = async () => {
    try {
      const [l, b] = await Promise.all([
        listarLancamentosCooperados({ competencia: soAbertos ? undefined : competencia, situacao: soAbertos ? 'aguardando,pendente,reservado' : undefined }),
        listarBloqueios(true),
      ]);
      setLancamentos(l);
      setBloqueios(b);
    } catch (err: any) { showToast(err?.message || 'Erro ao carregar lançamentos.', 'error'); }
  };
  useEffect(() => { carregar(); setPrevia(null); }, [competencia, soAbertos]);
  useEffect(() => { buscarCooperados('').then(setCooperados).catch(() => setCooperados([])); }, []);

  const opcoesCooperados = cooperados.map((c) => ({ valor: c.id, rotulo: `${c.nome}${c.matricula ? ` (${c.matricula})` : ''}${c.status !== 1 ? ` — ${ROTULO_STATUS_COOP[c.status] ?? c.status}` : ''}` }));

  const abrir = (cfg: Omit<React.ComponentProps<typeof ModalFormulario>, 'onClose' | 'onConfirmar'> & { acao: (v: ValoresFormulario) => Promise<unknown>; sucesso: string }) =>
    setModal({ ...cfg, onConfirmar: async (v) => { await cfg.acao(v); showToast(cfg.sucesso, 'success'); await carregar(); }, onClose: () => setModal(null) });
  const pedirMotivo = (titulo: string, acao: (m: string) => Promise<unknown>, sucesso: string, descricao?: string) =>
    abrir({ titulo, descricao, campos: [{ nome: 'motivo', rotulo: 'Motivo', tipo: 'textarea', obrigatorio: true }], acao: (v) => acao(v.motivo), sucesso });

  const verPrevia = async () => {
    setOcupado(true);
    try {
      const p = await previaLancamentos(competencia);
      setPrevia(p);
      setMarcadas(new Set(p.itens.filter((i) => i.situacao === 'novo').map((i) => i.chave)));
    } catch (err: any) { showToast(err?.message || 'Erro ao montar a prévia.', 'error'); }
    finally { setOcupado(false); }
  };

  const gerar = async () => {
    setOcupado(true);
    try {
      const r = await gerarLancamentos(competencia, [...marcadas]);
      showToast(`${r.criados} lançamento(s) gerado(s)${r.recusados.length ? ` · ${r.recusados.length} recusado(s)` : ''}.`, r.recusados.length ? 'warning' : 'success');
      await verPrevia();
      await carregar();
    } catch (err: any) { showToast(err?.message || 'Erro ao gerar lançamentos.', 'error'); }
    finally { setOcupado(false); }
  };

  const novoManual = () => abrir({
    titulo: 'Lançamento manual',
    descricao: 'Use para ajustes e descontos que não vêm dos cadastros. O motivo fica no histórico. Lançamentos iguais na mesma competência pedem confirmação.',
    campos: [
      { nome: 'candidatoId', rotulo: 'Cooperado', tipo: 'select', obrigatorio: true, opcoes: opcoesCooperados },
      { nome: 'tipo', rotulo: 'Tipo', tipo: 'select', obrigatorio: true, largura: 'metade', opcoes: [{ valor: 'debito', rotulo: 'Débito (desconto)' }, { valor: 'credito', rotulo: 'Crédito' }] },
      { nome: 'categoria', rotulo: 'Categoria', tipo: 'select', obrigatorio: true, largura: 'metade', opcoes: [{ valor: 'ajuste', rotulo: 'Ajuste' }, { valor: 'desconto_fixo', rotulo: 'Desconto' }, { valor: 'outro', rotulo: 'Outro' }] },
      { nome: 'competencia', rotulo: 'Competência (AAAA-MM)', obrigatorio: true, largura: 'metade' },
      { nome: 'compensarAPartir', rotulo: 'Descontar a partir de (AAAA-MM)', largura: 'metade', ajuda: 'Vazio = na própria competência.' },
      { nome: 'valor', rotulo: 'Valor', tipo: 'numero', obrigatorio: true, largura: 'metade' },
      { nome: 'descricao', rotulo: 'Descrição', obrigatorio: true, largura: 'metade' },
      { nome: 'motivo', rotulo: 'Motivo / origem (documento, acordo, ocorrência)', tipo: 'textarea', obrigatorio: true },
    ],
    valoresIniciais: { tipo: 'debito', categoria: 'ajuste', competencia, candidatoId: cooperados[0]?.id ?? '' },
    acao: async (v) => {
      try { await criarLancamentoManual(v); }
      catch (err) {
        const e = err as ErroComDetalhes;
        if (e.codigo !== 'POSSIVEL_DUPLICIDADE' || !window.confirm(`${e.message}\n\nRegistrar mesmo assim?`)) throw e;
        await criarLancamentoManual({ ...v, confirmarDuplicidade: true });
      }
    },
    sucesso: 'Lançamento registrado.',
  });

  const novoAdiantamento = () => abrir({
    titulo: 'Adiantamento ao cooperado',
    descricao: 'Cria o pagamento do adiantamento na fila (sujeito às mesmas travas de liberação) e um débito de compensação, que só passa a valer depois que o adiantamento for pago.',
    campos: [
      { nome: 'candidatoId', rotulo: 'Cooperado', tipo: 'select', obrigatorio: true, opcoes: opcoesCooperados },
      { nome: 'competencia', rotulo: 'Competência (AAAA-MM)', obrigatorio: true, largura: 'metade' },
      { nome: 'compensarAPartir', rotulo: 'Compensar a partir de (AAAA-MM)', obrigatorio: true, largura: 'metade' },
      { nome: 'valor', rotulo: 'Valor', tipo: 'numero', obrigatorio: true },
      { nome: 'motivo', rotulo: 'Motivo / solicitação', tipo: 'textarea', obrigatorio: true },
    ],
    valoresIniciais: { competencia, compensarAPartir: competencia, candidatoId: cooperados[0]?.id ?? '' },
    acao: (v) => registrarAdiantamento(v),
    sucesso: 'Adiantamento registrado na fila de pagamentos.',
  });

  return (
    <>
      <div className="monitoramento-table-card">
        <div className="table-card-header">
          <div>
            <h3 className="table-card-title">Gerar lançamentos da competência</h3>
            <p style={{ margin: '4px 0 0 0', fontSize: 13, color: '#64748b' }}>
              Fontes: remuneração importada no eSocial (bruto, INSS, IRRF), descontos fixos e cotas do cadastro do cooperado. Descontos em percentual e
              quota-parte não são lançados enquanto a ATESA não definir a regra. Cada item tem uma chave de origem: o mesmo desconto não é lançado duas vezes.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <input type="month" className="filter-input" value={competencia} onChange={(e) => setCompetencia(e.target.value)} />
            <button type="button" className="btn-secondary-filter" disabled={ocupado} onClick={verPrevia}>Ver prévia</button>
            {previa && <button type="button" className="btn-primary-filter" disabled={ocupado || marcadas.size === 0} onClick={gerar}>Gerar selecionados ({marcadas.size})</button>}
          </div>
        </div>
        {previa?.avisos.map((a, i) => <div key={i} style={{ padding: '8px 24px', background: '#fffbeb', color: '#92400e', fontSize: 13 }}>⚠ {a}</div>)}
        {previa && (
          <div className="table-responsive">
            <table className="monitoramento-table" style={{ fontSize: 12 }}>
              <thead><tr><th /><th>Cooperado</th><th>Origem</th><th>Descrição</th><th>Tipo</th><th style={{ textAlign: 'right' }}>Valor</th><th>Situação</th></tr></thead>
              <tbody>
                {previa.itens.length === 0 ? <tr><td colSpan={7} style={{ textAlign: 'center', padding: 20, color: '#94a3b8' }}>Nada a lançar.</td></tr>
                  : previa.itens.map((i) => {
                    const selecionavel = i.situacao === 'novo' || i.situacao === 'requer_confirmacao';
                    return (
                      <tr key={i.chave}>
                        <td><input type="checkbox" disabled={!selecionavel} checked={marcadas.has(i.chave)} onChange={() => { const s = new Set(marcadas); if (s.has(i.chave)) s.delete(i.chave); else s.add(i.chave); setMarcadas(s); }} /></td>
                        <td>{i.nome}</td>
                        <td>{{ esocial_remuneracao: 'Remuneração (eSocial)', cadastro_descontos: 'Cadastro de descontos', cota_mensal: 'Cotas mensais' }[i.fonte] ?? i.fonte}</td>
                        <td>{i.descricao}{i.observacao && <div style={{ color: '#64748b' }}>{i.observacao}</div>}</td>
                        <td>{i.tipo === 'credito' ? 'Crédito' : 'Débito'}</td>
                        <td style={{ textAlign: 'right' }}>{moeda(i.valor)}</td>
                        <td><span className={`badge-status ${ROTULO_PREVIA[i.situacao][1]}`}><span className="badge-status-dot" />{ROTULO_PREVIA[i.situacao][0]}</span></td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="monitoramento-table-card">
        <div className="table-card-header">
          <h3 className="table-card-title">Lançamentos (extrato dos cooperados)</h3>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <label style={{ fontSize: 13, display: 'flex', gap: 6, alignItems: 'center' }}>
              <input type="checkbox" checked={soAbertos} onChange={(e) => setSoAbertos(e.target.checked)} /> Somente em aberto (todas as competências)
            </label>
            <button type="button" className="btn-secondary-filter" onClick={novoManual}>+ Lançamento manual</button>
            <button type="button" className="btn-primary-filter" onClick={novoAdiantamento}>+ Adiantamento</button>
          </div>
        </div>
        <div className="table-responsive">
          <table className="monitoramento-table" style={{ fontSize: 12 }}>
            <thead><tr><th>Cooperado</th><th>Competência</th><th>Descrição</th><th>Origem</th><th style={{ textAlign: 'right' }}>Crédito</th><th style={{ textAlign: 'right' }}>Débito</th><th>Situação</th><th /></tr></thead>
            <tbody>
              {lancamentos.length === 0 ? <tr><td colSpan={8} style={{ textAlign: 'center', padding: 20, color: '#94a3b8' }}>Nenhum lançamento.</td></tr>
                : lancamentos.map((l) => (
                  <tr key={l.id} style={{ opacity: l.situacao === 'cancelado' ? 0.55 : 1 }}>
                    <td><strong>{l.cooperado_nome}</strong></td>
                    <td>{l.competencia}{l.compensar_a_partir && l.compensar_a_partir !== l.competencia && <div style={{ color: '#64748b' }}>descontar em {l.compensar_a_partir}</div>}</td>
                    <td>{l.descricao}{l.motivo && <div style={{ color: '#64748b' }}>{l.motivo}</div>}</td>
                    <td>{l.origem}{l.origem_ref && <div style={{ color: '#64748b' }}>{l.origem_ref}</div>}</td>
                    <td style={{ textAlign: 'right' }}>{l.tipo === 'credito' ? moeda(l.valor) : ''}</td>
                    <td style={{ textAlign: 'right' }}>{l.tipo === 'debito' ? moeda(l.valor) : ''}</td>
                    <td>{ROTULO_SITUACAO[l.situacao]}{l.pagamento_codigo && <div style={{ color: '#64748b' }}>{l.pagamento_codigo}</div>}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {l.situacao === 'pendente' && !['adiantamento', 'compensacao_adiantamento'].includes(l.categoria) && (
                        <button type="button" className="btn-action-obs" onClick={() => pedirMotivo('Cancelar lançamento', (m) => cancelarLancamento(l.id, m), 'Lançamento cancelado.')}>Cancelar</button>
                      )}{' '}
                      {l.tipo === 'debito' && ['pendente', 'reservado', 'aguardando'].includes(l.situacao) && (
                        <button type="button" className="btn-action-edit" onClick={() => abrir({
                          titulo: 'Adiar desconto', descricao: `${l.descricao} — ${moeda(l.valor)}`,
                          campos: [{ nome: 'compensarAPartir', rotulo: 'Descontar a partir de (AAAA-MM)', obrigatorio: true }, { nome: 'motivo', rotulo: 'Motivo', tipo: 'textarea', obrigatorio: true }],
                          valoresIniciais: { compensarAPartir: l.compensar_a_partir ?? l.competencia },
                          acao: (v) => adiarCompensacao(l.id, v.compensarAPartir, v.motivo), sucesso: 'Desconto adiado.',
                        })}>Adiar</button>
                      )}{' '}
                      {l.situacao === 'liquidado' && (
                        <button type="button" className="btn-action-obs" onClick={() => abrir({
                          titulo: 'Estornar lançamento liquidado', descricao: 'Gera um lançamento oposto, que entra no próximo pagamento do cooperado.',
                          campos: [{ nome: 'competencia', rotulo: 'Competência do estorno (AAAA-MM)', obrigatorio: true }, { nome: 'motivo', rotulo: 'Motivo', tipo: 'textarea', obrigatorio: true }],
                          valoresIniciais: { competencia },
                          acao: (v) => estornarLancamento(l.id, v.motivo, v.competencia), sucesso: 'Estorno lançado.',
                        })}>Estornar</button>
                      )}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="monitoramento-table-card">
        <div className="table-card-header">
          <div>
            <h3 className="table-card-title">Bloqueios de pagamento</h3>
            <p style={{ margin: '4px 0 0 0', fontSize: 13, color: '#64748b' }}>Pagamentos do cooperado bloqueado ficam retidos (valores preservados) até o desbloqueio.</p>
          </div>
          <button type="button" className="btn-secondary-filter" onClick={() => abrir({
            titulo: 'Bloquear pagamentos do cooperado',
            campos: [{ nome: 'candidatoId', rotulo: 'Cooperado', tipo: 'select', obrigatorio: true, opcoes: opcoesCooperados }, { nome: 'motivo', rotulo: 'Motivo', tipo: 'textarea', obrigatorio: true }],
            valoresIniciais: { candidatoId: cooperados[0]?.id ?? '' },
            acao: (v) => bloquearPagamentos(Number(v.candidatoId), v.motivo), sucesso: 'Pagamentos bloqueados.',
          })}>+ Bloquear</button>
        </div>
        <table className="monitoramento-table" style={{ fontSize: 12 }}>
          <tbody>
            {bloqueios.length === 0 ? <tr><td style={{ textAlign: 'center', padding: 16, color: '#94a3b8' }}>Nenhum bloqueio ativo.</td></tr>
              : bloqueios.map((b) => (
                <tr key={b.id}>
                  <td><strong>{b.cooperado_nome}</strong></td>
                  <td>{b.motivo}</td>
                  <td>{b.criado_por_nome} · {new Date(b.criado_em.replace(' ', 'T')).toLocaleDateString('pt-BR')}</td>
                  <td><button type="button" className="btn-action-view" onClick={() => pedirMotivo('Encerrar bloqueio', (m) => encerrarBloqueio(b.id, m), 'Bloqueio encerrado.')}>Desbloquear</button></td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      {modal && <ModalFormulario {...modal} />}
    </>
  );
};

export default LancamentosCooperados;
