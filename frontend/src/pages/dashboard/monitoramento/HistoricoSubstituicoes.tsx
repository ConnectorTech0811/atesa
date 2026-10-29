import React, { useEffect, useMemo, useState } from 'react';
import './Monitoramento.css';
import { formatarDataBR, parseDataHoraServidor } from '../../../utils/formatters';
import { OpcoesEscala, RegistroSubstituicao, listarSubstituicoes } from '../../../api/escalaFaturamentoApi';

interface Props {
  /** Com cooperado: só as substituições em que ele saiu ou cobriu (Monitoramento), sem filtros. */
  candidatoId?: number;
  /** Clientes e vagas para os filtros (aba de Escalas). */
  opcoes?: OpcoesEscala | null;
  /** Muda quando uma substituição nova é gravada, para recarregar. */
  versao?: number;
}

const ROTULO_PERIODO: Record<string, string> = {
  '1d': '1 dia', '7d': '7 dias', '15d': '15 dias', '1m': '1 mês', personalizado: 'Período informado', definitiva: 'Definitiva',
};

const dataHora = (v: string) => {
  const d = parseDataHoraServidor(v);
  return isNaN(d.getTime()) ? v : `${d.toLocaleDateString('pt-BR')} ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
};
const periodoTexto = (r: RegistroSubstituicao) => (
  r.tipo === 'definitiva' ? `A partir de ${formatarDataBR(r.data_inicio)}`
    : r.data_fim && r.data_fim !== r.data_inicio ? `${formatarDataBR(r.data_inicio)} a ${formatarDataBR(r.data_fim)}`
      : formatarDataBR(r.data_inicio)
);
const postoTexto = (r: RegistroSubstituicao) => r.posto || [r.vaga_cargo, r.nome_unidade, r.nome_empresa].filter(Boolean).join(' · ') || '—';

/** Histórico imutável das substituições/coberturas: quem saiu, quem cobriu, posto/vaga, período, motivo e autor. */
export const HistoricoSubstituicoes: React.FC<Props> = ({ candidatoId, opcoes, versao }) => {
  const comFiltros = !candidatoId;
  const [registros, setRegistros] = useState<RegistroSubstituicao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [empresaId, setEmpresaId] = useState<number | ''>('');
  const [vagaId, setVagaId] = useState<number | ''>('');
  const [busca, setBusca] = useState('');

  useEffect(() => {
    let ativo = true;
    setCarregando(true);
    const t = setTimeout(() => {
      listarSubstituicoes({
        candidatoId,
        empresaId: empresaId || undefined,
        vagaId: vagaId || undefined,
        dataInicio: dataInicio || undefined,
        dataFim: dataFim || undefined,
        busca: busca.trim() || undefined,
      })
        .then((r) => { if (ativo) { setRegistros(r); setErro(''); } })
        .catch((e) => { if (ativo) setErro(e?.message || 'Erro ao carregar o histórico de substituições.'); })
        .finally(() => { if (ativo) setCarregando(false); });
    }, 250);
    return () => { ativo = false; clearTimeout(t); };
  }, [candidatoId, empresaId, vagaId, dataInicio, dataFim, busca, versao]);

  const vagasCliente = useMemo(
    () => (opcoes?.vagas ?? []).filter((v) => !empresaId || v.empresa_id === empresaId),
    [opcoes, empresaId],
  );

  const exportar = async () => {
    const XLSX = await import('xlsx');
    const ws = XLSX.utils.json_to_sheet(registros.map((r) => ({
      'Registrado em': dataHora(r.criado_em),
      'Registrado por': r.usuario_nome || '',
      'Perfil': r.usuario_perfil_rotulo || '',
      'Tipo': r.tipo === 'definitiva' ? 'Assumiu a vaga (definitiva)' : 'Cobertura',
      'Saiu do posto': r.titular_nome,
      'Matrícula (saiu)': r.titular_matricula || '',
      'Cobriu / assumiu': r.substituto_nome,
      'Matrícula (cobriu)': r.substituto_matricula || '',
      'Cliente': r.nome_empresa || '',
      'Posto / Vaga': postoTexto(r),
      'Período': `${ROTULO_PERIODO[r.periodo] ?? r.periodo} — ${periodoTexto(r)}`,
      'Plantões transferidos': r.plantoes,
      'Motivo': r.motivo_rotulo,
      'Justificativa': r.motivo,
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Substituições');
    XLSX.writeFile(wb, 'HISTORICO DE SUBSTITUICOES.xlsx');
  };

  return (
    <div className="monitoramento-table-card">
      <div className="table-card-header" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h3 className="table-card-title">Histórico de Substituições e Coberturas</h3>
          <p style={{ margin: '4px 0 0 0', fontSize: 13, color: '#64748b' }}>
            Registro permanente de cada cobertura: quem saiu, quem cobriu, posto/vaga, período, motivo e quem registrou (nome, perfil, data e hora).
          </p>
        </div>
        <button type="button" className="btn-action-view" onClick={exportar} disabled={registros.length === 0}>Exportar</button>
      </div>

      {comFiltros && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, padding: '0 24px 14px' }}>
          <input className="filter-input" style={{ minWidth: 220, flex: 1 }} placeholder="Buscar cooperado, matrícula, posto ou autor..." value={busca} onChange={(e) => setBusca(e.target.value)} />
          <select className="filter-select" value={empresaId} onChange={(e) => { setEmpresaId(e.target.value ? Number(e.target.value) : ''); setVagaId(''); }} aria-label="Cliente">
            <option value="">Todos os clientes</option>
            {(opcoes?.empresas ?? []).map((e) => <option key={e.id} value={e.id}>{e.nome_empresa}</option>)}
          </select>
          <select className="filter-select" value={vagaId} onChange={(e) => setVagaId(e.target.value ? Number(e.target.value) : '')} aria-label="Vaga">
            <option value="">Todas as vagas</option>
            {vagasCliente.map((v) => <option key={v.id} value={v.id}>{v.cargo} · {v.nome_unidade}</option>)}
          </select>
          <input type="date" className="filter-input" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} aria-label="Período de" title="Coberturas a partir de" />
          <input type="date" className="filter-input" value={dataFim} onChange={(e) => setDataFim(e.target.value)} aria-label="Período até" title="Coberturas até" />
        </div>
      )}

      {erro && <div style={{ margin: '0 24px 12px', padding: 12, background: '#fee2e2', color: '#991b1b', borderRadius: 8, fontSize: 13 }}>{erro}</div>}

      <div className="table-responsive">
        <table className="monitoramento-table">
          <thead>
            <tr>
              <th>Registrado</th>
              <th>Tipo</th>
              <th>Saiu do posto</th>
              <th>Cobriu / Assumiu</th>
              <th>Posto / Vaga</th>
              <th>Período</th>
              <th>Motivo</th>
            </tr>
          </thead>
          <tbody>
            {carregando && registros.length === 0 ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: 28, color: '#64748b' }}>Carregando...</td></tr>
            ) : registros.length === 0 ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: 28, color: '#94a3b8' }}>Nenhuma substituição registrada.</td></tr>
            ) : registros.map((r) => {
              const destaque = (id: number) => (candidatoId === id ? { fontWeight: 700, color: '#0f172a' } : {});
              return (
                <tr key={r.id}>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <div style={{ fontWeight: 600 }}>{dataHora(r.criado_em)}</div>
                    <div style={{ fontSize: 12, color: '#475569' }}>por <strong>{r.usuario_nome || '—'}</strong></div>
                    {r.usuario_perfil_rotulo && <div style={{ fontSize: 11.5, color: '#64748b' }}>{r.usuario_perfil_rotulo}</div>}
                  </td>
                  <td>
                    <span className="badge-status" style={r.tipo === 'definitiva'
                      ? { background: '#fffbeb', color: '#92400e', border: '1px solid #fde68a' }
                      : { background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0' }}>
                      {r.tipo === 'definitiva' ? 'Assumiu a vaga' : 'Cobertura'}
                    </span>
                  </td>
                  <td>
                    <div style={destaque(r.titular_id)}>{r.titular_nome}</div>
                    {r.titular_matricula && <div style={{ fontSize: 11.5, color: '#64748b' }}>Mat. {r.titular_matricula}</div>}
                  </td>
                  <td>
                    <div style={destaque(r.substituto_id)}>{r.substituto_nome}</div>
                    {r.substituto_matricula && <div style={{ fontSize: 11.5, color: '#64748b' }}>Mat. {r.substituto_matricula}</div>}
                  </td>
                  <td style={{ maxWidth: 240 }}>{postoTexto(r)}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <div>{periodoTexto(r)}</div>
                    <div style={{ fontSize: 11.5, color: '#64748b' }}>{ROTULO_PERIODO[r.periodo] ?? r.periodo} · {r.plantoes} plantão(ões)</div>
                  </td>
                  <td style={{ maxWidth: 260 }}>
                    <div style={{ fontWeight: 600 }}>{r.motivo_rotulo}</div>
                    <div style={{ fontSize: 12, color: '#475569' }}>{r.motivo}</div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default HistoricoSubstituicoes;
