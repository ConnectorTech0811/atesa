import React, { useCallback, useEffect, useState } from 'react';
import { IonButton } from '@ionic/react';
import { useToast } from '../../components/ToastContext';
import { usePermissoes } from '../../auth/PermissoesContext';
import { carregarTaxas, salvarCargos, salvarParametros } from '../../api/taxasApi';
import { IconPlus, IconTrash } from '../../components/Icons';
import CustoPorFuncaoSimulator from '../../components/CustoPorFuncaoSimulator';

type Params = Record<string, number>;

const cardStyle: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #e0e0e0',
  borderRadius: 10,
  padding: '20px 22px',
  marginBottom: 20,
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 700,
  color: '#222',
  borderBottom: '2px solid #c8e6c9',
  paddingBottom: 6,
  marginBottom: 14,
  marginTop: 0,
};

function normalizarPct(val: any, padrao: number): number {
  if (val === undefined || val === null) return padrao;
  const n = Number(val);
  if (isNaN(n)) return padrao;
  if (n > 0 && n < 0.5) return Number((n * 100).toFixed(4));
  return n;
}

const TaxasImpostos: React.FC = () => {
  const { showToast } = useToast();
  const { temPermissao } = usePermissoes();
  const [abaAtiva, setAbaAtiva] = useState<'taxas' | 'cargos'>('taxas');
  const [params, setParams] = useState<Params>({});
  const [cargos, setCargos] = useState<Record<string, string[]>>({});
  const [novoCargo, setNovoCargo] = useState('');
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const data = await carregarTaxas();
      if (data) {
        const raw = data.parametros || {};
        const p: Params = {};
        for (const [k, v] of Object.entries(raw)) {
          if ([
            'pis_rnc', 'pis_rc', 'pis_esfl', 'cofins_rnc', 'cofins_rc', 'cofins_esfl',
            'iss_geral', 'irrf_geral', 'taxa_adm', 'inss_patronal', 'rateio_percentual',
            'inss_cooperado_aliq', 'iss_emissao_prestacao_sp', 'iss_emissao_prestacao_ce',
            'iss_emissao_prestacao_pe', 'iss_emissao_sp_prestacao_ce',
            'insalubridade_baixo', 'insalubridade_medio', 'insalubridade_alto',
            'periculosidade_sim', 'dar_pre',
          ].includes(k)) {
            p[k] = normalizarPct(v, v);
          } else {
            p[k] = Number(v) || 0;
          }
        }

        // Padrões oficiais ATESA
        if (p.irrf_geral === undefined) p.irrf_geral = 1.50;
        if (p.pis_rc === undefined) p.pis_rc = 0.65;
        if (p.cofins_rc === undefined) p.cofins_rc = 3.00;
        if (p.iss_geral === undefined || p.iss_geral === 2.0) p.iss_geral = 2.50;
        if (p.taxa_adm === undefined) p.taxa_adm = 17.00;
        if (p.inss_patronal === undefined) p.inss_patronal = 20.00;
        if (p.dar_pre === undefined) p.dar_pre = 8.33;
        if (p.salario_minimo_base === undefined) p.salario_minimo_base = 1621.00;
        if (p.seguro_vida_valor === undefined) p.seguro_vida_valor = 4.12;
        if (p.rateio_percentual === undefined) p.rateio_percentual = 3.00;
        if (p.cota_parte_integracao === undefined) p.cota_parte_integracao = 10.00;
        if (p.inss_teto === undefined) p.inss_teto = 8475.55;
        if (p.inss_cooperado_aliq === undefined) p.inss_cooperado_aliq = 20.00;
        if (p.insalubridade_baixo === undefined) p.insalubridade_baixo = 10.00;
        if (p.insalubridade_medio === undefined) p.insalubridade_medio = 20.00;
        if (p.insalubridade_alto === undefined) p.insalubridade_alto = 40.00;
        if (p.periculosidade_sim === undefined) p.periculosidade_sim = 30.00;

        setParams(p);

        const c: Record<string, string[]> = {};
        if (data.cargos) {
          for (const [coop, lista] of Object.entries(data.cargos)) {
            c[coop] = Array.isArray(lista) ? lista.map((x) => x.cargo) : [];
          }
        }
        if (!c['ATESA'] || c['ATESA'].length === 0) {
          c['ATESA'] = [
            'AUXILIAR DE ENFERMAGEM',
            'TÉCNICO DE ENFERMAGEM',
            'ENFERMEIRO',
            'CUIDADOR',
            'FONOAUDIÓLOGO',
            'FISIOTERAPEUTA',
            'PSICÓLOGO',
            'TERAPEUTA OCUPACIONAL',
          ];
        }
        setCargos(c);
      }
    } catch (e: any) {
      console.error('Erro ao carregar taxas:', e);
      showToast(e?.message || 'Erro ao carregar taxas e impostos.', 'error');
    } finally {
      setCarregando(false);
    }
  }, [showToast]);

  useEffect(() => { carregar(); }, [carregar]);

  const salvarParametrosOficiais = async (novosParametros: Record<string, number>) => {
    try {
      const atualizados = { ...params, ...novosParametros };
      await salvarParametros(atualizados);
      setParams(atualizados);
      showToast('Taxas e impostos oficiais salvos com sucesso no banco de dados! As propostas já utilizam estas alíquotas.', 'success');
    } catch (e: any) {
      showToast(e?.message || 'Erro ao salvar parâmetros no banco.', 'error');
      throw e;
    }
  };

  const salvarCargosCoop = async (coop: string, novaLista: string[]) => {
    try {
      await salvarCargos(coop, novaLista);
      setCargos((prev) => ({ ...prev, [coop]: novaLista }));
      showToast('Lista de cargos atualizada com sucesso!', 'success');
    } catch (e: any) {
      showToast(e?.message || 'Erro ao salvar cargos.', 'error');
    }
  };

  const handleAdicionarCargo = () => {
    if (!novoCargo.trim()) return;
    const lista = [...(cargos['ATESA'] || [])];
    if (!lista.includes(novoCargo.trim().toUpperCase())) {
      lista.push(novoCargo.trim().toUpperCase());
      salvarCargosCoop('ATESA', lista);
      setNovoCargo('');
    }
  };

  const handleRemoverCargo = (cargoParaRemover: string) => {
    const lista = (cargos['ATESA'] || []).filter((c) => c !== cargoParaRemover);
    salvarCargosCoop('ATESA', lista);
  };

  if (carregando) return (
    <div style={{ padding: 40, textAlign: 'center', color: '#888', fontSize: 14 }}>
      Carregando taxas e impostos…
    </div>
  );

  const listaCargosAtuais = cargos['ATESA'] ?? [];

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1120, margin: '0 auto' }}>

      {/* Cabeçalho */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: '#1b5e20', margin: 0 }}>
            Taxas e Impostos
          </h2>
          <p style={{ fontSize: 13, color: '#555', marginTop: 4, maxWidth: 800, lineHeight: 1.5 }}>
            Fórmulas, simulação e parâmetros oficiais da Cooperativa ATESA.
            As alíquotas (<strong>IRRF, PIS, COFINS, ISS</strong>, taxas e retenções) salvas aqui são gravadas no banco de dados e refletem automaticamente em todas as propostas comerciais.
          </p>
        </div>
      </div>

      {/* Navegação por Sub-abas */}
      <div style={{ display: 'flex', gap: 8, borderBottom: '2px solid #e0e0e0', marginBottom: 20, flexWrap: 'wrap' }}>
        <button
          onClick={() => setAbaAtiva('taxas')}
          style={{
            padding: '10px 18px',
            fontSize: 13,
            fontWeight: abaAtiva === 'taxas' ? 700 : 500,
            color: abaAtiva === 'taxas' ? '#1b5e20' : '#666',
            border: 'none',
            background: 'none',
            borderBottom: abaAtiva === 'taxas' ? '3px solid #1b5e20' : '3px solid transparent',
            cursor: 'pointer',
          }}
        >
          📊 Taxas e Impostos
        </button>

        <button
          onClick={() => setAbaAtiva('cargos')}
          style={{
            padding: '10px 18px',
            fontSize: 13,
            fontWeight: abaAtiva === 'cargos' ? 700 : 500,
            color: abaAtiva === 'cargos' ? '#1b5e20' : '#666',
            border: 'none',
            background: 'none',
            borderBottom: abaAtiva === 'cargos' ? '3px solid #1b5e20' : '3px solid transparent',
            cursor: 'pointer',
          }}
        >
          💼 Cargos & Funções da Cooperativa ({listaCargosAtuais.length})
        </button>
      </div>

      {/* ── ABA 1: TAXAS E IMPOSTOS (SIMULADOR E REGRAS INTEGRADAS) ── */}
      {abaAtiva === 'taxas' && (
        <div>
          <CustoPorFuncaoSimulator
            taxas={params}
            cargosDisponiveis={listaCargosAtuais}
            modo="geral"
            podeEditarPadrao={temPermissao('taxas.editar')}
            onSalvarParametrosPadrao={salvarParametrosOficiais}
          />
        </div>
      )}

      {/* ── ABA 2: CARGOS E FUNÇÕES DA COOPERATIVA ── */}
      {abaAtiva === 'cargos' && (
        <div style={cardStyle}>
          <h3 style={{ ...sectionTitleStyle, color: '#1b5e20' }}>
            Lista Oficial de Cargos e Funções (ATESA)
          </h3>
          <p style={{ fontSize: 13, color: '#666', marginBottom: 16 }}>
            Estes cargos aparecem disponíveis no seletor de funções em todas as propostas comerciais do Painel Executivo.
          </p>

          <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
            <input
              type="text"
              placeholder="Digite o nome do novo cargo (ex: NUTRICIONISTA)..."
              value={novoCargo}
              onChange={(e) => setNovoCargo(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAdicionarCargo(); }}
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: 6,
                border: '1px solid #ccc',
                fontSize: 13,
              }}
            />
            <IonButton size="small" color="primary" shape="round" onClick={handleAdicionarCargo}>
              <IconPlus size={14} style={{ marginRight: 4 }} /> Adicionar Cargo
            </IonButton>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
            {listaCargosAtuais.map((cargo, idx) => (
              <div
                key={cargo}
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: 6,
                  padding: '8px 12px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>
                  {idx + 1}. {cargo}
                </span>
                <button
                  type="button"
                  onClick={() => handleRemoverCargo(cargo)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#dc2626',
                    cursor: 'pointer',
                    padding: 4,
                  }}
                  title="Remover cargo"
                >
                  <IconTrash size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
};

export default TaxasImpostos;
