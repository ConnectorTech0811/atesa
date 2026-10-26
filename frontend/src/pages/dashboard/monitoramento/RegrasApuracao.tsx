import React, { useEffect, useState } from 'react';
import { useToast } from '../../../components/ToastContext';
import { RegrasApuracao as Regras, obterRegrasApuracao, salvarRegrasApuracao } from '../../../api/escalaFaturamentoApi';

/** Regras usadas na apuração das jornadas (valores padrão até a ATESA confirmar). */
export const RegrasApuracao: React.FC = () => {
  const { showToast } = useToast();
  const [regras, setRegras] = useState<Regras | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    obterRegrasApuracao().then(setRegras).catch((e) => showToast(e?.message || 'Erro ao carregar as regras.', 'error'));
  }, []);

  if (!regras) return <div className="monitoramento-table-card" style={{ padding: 24, color: '#94a3b8' }}>Carregando regras...</div>;
  const upd = <K extends keyof Regras>(k: K, v: Regras[K]) => setRegras((r) => (r ? { ...r, [k]: v } : r));

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    setSalvando(true);
    try {
      setRegras(await salvarRegrasApuracao(regras));
      showToast('Regras de apuração salvas. Reapure os processos abertos para aplicar.', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Erro ao salvar.', 'error');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <form className="monitoramento-table-card" onSubmit={salvar}>
      <div className="table-card-header">
        <div>
          <h3 className="table-card-title">Regras de apuração das jornadas</h3>
          <p style={{ margin: '4px 0 0 0', fontSize: 13, color: '#64748b' }}>
            {regras.personalizadas
              ? `Alteradas por ${regras.atualizado_por_nome ?? '—'}.`
              : 'Usando os valores padrão do sistema — aguardando confirmação da ATESA.'}
            {' '}Valem para a planilha e para novas apurações dos processos de faturamento.
          </p>
        </div>
        <button type="submit" className="btn-primary-filter" disabled={salvando}>{salvando ? 'Salvando...' : 'Salvar regras'}</button>
      </div>
      <div style={{ padding: '16px 24px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 18 }}>
        <div className="filter-item">
          <label htmlFor="ra-tol">Tolerância para extra/falta (min por plantão)</label>
          <input id="ra-tol" type="number" min={0} max={120} className="filter-input" value={regras.tolerancia_minutos} onChange={(e) => upd('tolerancia_minutos', Number(e.target.value))} />
          <small style={{ color: '#64748b' }}>Diferença até este limite não gera extra nem falta. Acima dele, conta a diferença inteira (CLT art. 58 §1º usa 10 min).</small>
        </div>
        <div className="filter-item">
          <label>Janela do adicional noturno</label>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input type="time" className="filter-input" value={regras.noturno_inicio} onChange={(e) => upd('noturno_inicio', e.target.value)} aria-label="Início do noturno" />
            <span>–</span>
            <input type="time" className="filter-input" value={regras.noturno_fim} onChange={(e) => upd('noturno_fim', e.target.value)} aria-label="Fim do noturno" />
          </div>
          <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontWeight: 400, marginTop: 6 }}>
            <input type="checkbox" checked={regras.hora_noturna_reduzida} onChange={(e) => upd('hora_noturna_reduzida', e.target.checked)} />
            Hora noturna reduzida (52min30s)
          </label>
          <small style={{ color: '#64748b' }}>O adicional só é pago nas vagas marcadas com adicional noturno no Parâmetro.</small>
        </div>
        <div className="filter-item">
          <label htmlFor="ra-ref">Refeição não registrada no App</label>
          <select id="ra-ref" className="filter-select" value={regras.refeicao_nao_registrada} onChange={(e) => upd('refeicao_nao_registrada', e.target.value as Regras['refeicao_nao_registrada'])}>
            <option value="descontar_parametro">Descontar o tempo de refeição da vaga</option>
            <option value="nao_descontar">Não descontar</option>
          </select>
          <small style={{ color: '#64748b' }}>Só se aplica às vagas que descontam refeição.</small>
        </div>
        <div className="filter-item">
          <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input type="checkbox" checked={regras.extras_automaticos} onChange={(e) => upd('extras_automaticos', e.target.checked)} />
            Apurar extra e falta automaticamente
          </label>
          <small style={{ color: '#64748b' }}>Desligue se a Supervisão continuar lançando as horas extras só como complemento (evita contar em dobro).</small>
        </div>
        <div className="filter-item">
          <label htmlFor="ra-max">Entrada sem saída após (h)</label>
          <input id="ra-max" type="number" min={12} max={48} className="filter-input" value={regras.jornada_maxima_horas} onChange={(e) => upd('jornada_maxima_horas', Number(e.target.value))} />
          <small style={{ color: '#64748b' }}>Acima disso a entrada é considerada sem saída, em vez de casar com a saída de outro plantão.</small>
        </div>
        <div className="filter-item">
          <label htmlFor="ra-jan">Tolerância para casar com a escala (h)</label>
          <input id="ra-jan" type="number" min={1} max={12} className="filter-input" value={regras.janela_escala_horas} onChange={(e) => upd('janela_escala_horas', Number(e.target.value))} />
          <small style={{ color: '#64748b' }}>Entrada até este tempo antes/depois do início previsto é ligada ao plantão da escala.</small>
        </div>
      </div>
    </form>
  );
};

export default RegrasApuracao;
