import React, { useEffect, useState } from 'react';
import { IonButton } from '@ionic/react';
import { useToast } from '../../../components/ToastContext';
import {
  OpcoesEscala,
  PlanilhaFaturamento,
  gerarPlanilhaFaturamento,
  obterOpcoesEscala,
} from '../../../api/escalaFaturamentoApi';
import PlanilhaValoresFaturamento from '../monitoramento/PlanilhaValoresFaturamento';

const competenciaAnterior = (() => {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
})();

/**
 * Planilha de faturamento com valores (R$) dentro de Taxas e Impostos.
 * As quantidades vêm direto das escalas apuradas do cliente na competência
 * (mesma apuração da Supervisão); taxas e impostos vêm do Parâmetro e de Taxas e Impostos.
 */
const PlanilhaFaturamentoTaxas: React.FC = () => {
  const { showToast } = useToast();
  const [opcoes, setOpcoes] = useState<OpcoesEscala>({ cooperados: [], empresas: [], alocacoes: [], vagas: [] });
  const [empresaId, setEmpresaId] = useState<number | ''>('');
  const [competencia, setCompetencia] = useState(competenciaAnterior);
  const [planilha, setPlanilha] = useState<PlanilhaFaturamento | null>(null);
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    obterOpcoesEscala().then(setOpcoes).catch((e) => showToast(e?.message || 'Erro ao carregar clientes.', 'error'));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- carrega uma vez
  }, []);

  // Trocar cliente/competência descarta a planilha anterior
  useEffect(() => { setPlanilha(null); }, [empresaId, competencia]);

  const puxarDasEscalas = async () => {
    if (!empresaId) { showToast('Selecione o cliente.', 'warning'); return; }
    if (!/^\d{4}-\d{2}$/.test(competencia)) { showToast('Informe a competência.', 'warning'); return; }
    setCarregando(true);
    try {
      const p = await gerarPlanilhaFaturamento({ empresaId: Number(empresaId), competencia });
      setPlanilha(p);
      if (!p.linhas.length) showToast('Nenhuma escala apurada para este cliente na competência.', 'warning');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Erro ao puxar as escalas.', 'error');
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div>
      <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 10, padding: '16px 20px', marginBottom: 16 }}>
        <p style={{ fontSize: 13, color: '#555', margin: '0 0 12px' }}>
          Escolha o cliente e a competência: as quantidades são puxadas das <strong>escalas apuradas</strong> e os valores
          calculados com a taxa do Parâmetro e as alíquotas desta tela.
        </p>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, fontWeight: 600, minWidth: 260, flex: 1 }}>
            Cliente
            <select className="form-input" value={empresaId} onChange={(e) => setEmpresaId(e.target.value ? Number(e.target.value) : '')}>
              <option value="">Selecione...</option>
              {opcoes.empresas.map((e) => <option key={e.id} value={e.id}>{e.nome_empresa}</option>)}
            </select>
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, fontWeight: 600 }}>
            Competência
            <input className="form-input" type="month" value={competencia} onChange={(e) => setCompetencia(e.target.value)} />
          </label>
          <IonButton size="small" color="success" onClick={puxarDasEscalas} disabled={carregando || !empresaId}>
            {carregando ? 'Puxando…' : 'Puxar das escalas'}
          </IonButton>
        </div>
      </div>

      {planilha && <PlanilhaValoresFaturamento empresaId={empresaId} planilha={planilha} />}
    </div>
  );
};

export default PlanilhaFaturamentoTaxas;
