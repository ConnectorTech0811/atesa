import React, { useCallback, useEffect, useState } from 'react';
import { IonButton } from '@ionic/react';
import { useToast } from '../../components/ToastContext';
import { usePermissoes } from '../../auth/PermissoesContext';
import { carregarTaxas, salvarCargos, salvarParametros } from '../../api/taxasApi';
import { IconPlus, IconTrash } from '../../components/Icons';
import { aliquotaEmPercentual } from '../../utils/aliquotas';
import CustoPorFuncaoSimulator from '../../components/CustoPorFuncaoSimulator';
import { useAuth } from '../../auth/AuthContext';
import { calcularAcessoFaturamento } from '../../auth/acessoFaturamento';
import PlanilhaFaturamentoTaxas from './taxas/PlanilhaFaturamentoTaxas';
import MunicipiosNfse from './monitoramento/MunicipiosNfse';

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

const CAMPOS_ALIQUOTA = [
  { chave: 'irrf_geral', rotulo: 'IRRF Faturamento' },
  { chave: 'pis_rc', rotulo: 'PIS' },
  { chave: 'cofins_rc', rotulo: 'COFINS' },
  { chave: 'iss_geral', rotulo: 'ISS' },
] as const;

// ISS por estado (usado na planilha de faturamento quando o cliente ainda não tem NFS-e emitida)
const CAMPOS_ISS_ESTADO = [
  { chave: 'iss_emissao_prestacao_sp', rotulo: 'ISS — Emissão e prestação SP' },
  { chave: 'iss_emissao_prestacao_ce', rotulo: 'ISS — Emissão e prestação CE' },
  { chave: 'iss_emissao_prestacao_pe', rotulo: 'ISS — Emissão e prestação PE' },
  { chave: 'iss_emissao_sp_prestacao_ce', rotulo: 'ISS — Emissão SP / prestação CE' },
] as const;

const TODOS_CAMPOS = [...CAMPOS_ALIQUOTA, ...CAMPOS_ISS_ESTADO];

type ChaveAliquota = typeof TODOS_CAMPOS[number]['chave'];
type AbaTaxas = 'taxas' | 'planilha' | 'prefeituras' | 'cargos';

function normalizarPct(val: unknown, padrao: number): number {
  return aliquotaEmPercentual(val, padrao);
}

const TaxasImpostos: React.FC = () => {
  const { showToast } = useToast();
  const { usuario } = useAuth();
  const { permissoes, temPermissao } = usePermissoes();
  // Planilha (R$) e Prefeituras usam as rotas do Faturamento: mesma liberação
  const verFaturamento = calcularAcessoFaturamento(usuario?.perfil, permissoes);
  const [abaAtiva, setAbaAtiva] = useState<AbaTaxas>('taxas');
  const [params, setParams] = useState<Params>({});
  const [cargos, setCargos] = useState<Record<string, string[]>>({});
  const [novoCargo, setNovoCargo] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [aliquotas, setAliquotas] = useState<Partial<Record<ChaveAliquota, string>>>({});
  const [salvandoAliquotas, setSalvandoAliquotas] = useState(false);
  const podeEditar = temPermissao('taxas.editar');

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
        setAliquotas(Object.fromEntries(TODOS_CAMPOS.map(({ chave }) => [chave, p[chave] === undefined ? '' : String(p[chave])])));

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
      setAliquotas((a) => ({ ...a, ...Object.fromEntries(TODOS_CAMPOS.filter(({ chave }) => chave in novosParametros).map(({ chave }) => [chave, String(novosParametros[chave])])) }));
      showToast('Taxas e impostos oficiais salvos com sucesso no banco de dados! As propostas já utilizam estas alíquotas.', 'success');
    } catch (e: any) {
      showToast(e?.message || 'Erro ao salvar parâmetros no banco.', 'error');
      throw e;
    }
  };

  const handleSalvarAliquotas = async () => {
    const novos: Record<string, number> = {};
    for (const { chave, rotulo } of TODOS_CAMPOS) {
      const bruto = String(aliquotas[chave] ?? '').trim();
      if (bruto === '' && CAMPOS_ISS_ESTADO.some((c) => c.chave === chave)) continue;
      const v = Number(bruto.replace(',', '.'));
      if (!Number.isFinite(v) || v < 0 || v > 100) {
        showToast(`Informe um percentual válido para ${rotulo}.`, 'warning');
        return;
      }
      novos[chave] = v;
    }
    setSalvandoAliquotas(true);
    try {
      await salvarParametrosOficiais(novos);
    } catch {
      // toast já exibido
    } finally {
      setSalvandoAliquotas(false);
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
        {([
          ['taxas', '📊 Alíquotas'],
          ...(verFaturamento ? [['planilha', '📑 Planilha de Faturamento (R$)'], ['prefeituras', '🏛️ Prefeituras (NFS-e / ISS)']] : []),
          ['cargos', `💼 Cargos & Funções da Cooperativa (${listaCargosAtuais.length})`],
        ] as [AbaTaxas, string][]).map(([id, rotulo]) => (
          <button
            key={id}
            onClick={() => setAbaAtiva(id)}
            style={{
              padding: '10px 18px',
              fontSize: 13,
              fontWeight: abaAtiva === id ? 700 : 500,
              color: abaAtiva === id ? '#1b5e20' : '#666',
              border: 'none',
              background: 'none',
              borderBottom: abaAtiva === id ? '3px solid #1b5e20' : '3px solid transparent',
              cursor: 'pointer',
            }}
          >
            {rotulo}
          </button>
        ))}
      </div>

      {abaAtiva === 'planilha' && verFaturamento && <PlanilhaFaturamentoTaxas />}
      {abaAtiva === 'prefeituras' && verFaturamento && <MunicipiosNfse />}

      {/* ── ABA 1: TAXAS E IMPOSTOS (alíquotas fiscais + simulador) ── */}
      {abaAtiva === 'taxas' && (
        <div style={cardStyle}>
          <h3 style={{ ...sectionTitleStyle, color: '#1b5e20' }}>Alíquotas Fiscais da Cooperativa</h3>
          <p style={{ fontSize: 13, color: '#666', marginBottom: 16 }}>
            Percentuais usados nas propostas comerciais e no faturamento. Informe em % (ex.: PIS 0,65 = 0,65%).
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 18 }}>
            {CAMPOS_ALIQUOTA.map(({ chave, rotulo }) => (
              <label key={chave} style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, fontWeight: 700, color: '#334155', textTransform: 'uppercase' }}>
                {rotulo}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    max={100}
                    value={aliquotas[chave] ?? ''}
                    disabled={!podeEditar}
                    onChange={(e) => setAliquotas((a) => ({ ...a, [chave]: e.target.value }))}
                    style={{ flex: 1, padding: '8px 10px', borderRadius: 6, border: '1px solid #ccc', fontSize: 14, textAlign: 'right', background: podeEditar ? '#fff' : '#f1f5f9' }}
                  />
                  <span style={{ fontSize: 13, color: '#666', fontWeight: 600 }}>%</span>
                </div>
              </label>
            ))}
          </div>
          <h4 style={{ fontSize: 13, fontWeight: 700, color: '#334155', margin: '4px 0 10px' }}>ISS por estado</h4>
          <p style={{ fontSize: 12, color: '#666', margin: '0 0 10px' }}>
            Usado na planilha de faturamento quando o cliente ainda não tem NFS-e emitida (depois vale a alíquota da última nota).
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 18 }}>
            {CAMPOS_ISS_ESTADO.map(({ chave, rotulo }) => (
              <label key={chave} style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, fontWeight: 600, color: '#334155' }}>
                {rotulo}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    max={100}
                    value={aliquotas[chave] ?? ''}
                    disabled={!podeEditar}
                    onChange={(e) => setAliquotas((a) => ({ ...a, [chave]: e.target.value }))}
                    style={{ flex: 1, padding: '8px 10px', borderRadius: 6, border: '1px solid #ccc', fontSize: 14, textAlign: 'right', background: podeEditar ? '#fff' : '#f1f5f9' }}
                  />
                  <span style={{ fontSize: 13, color: '#666', fontWeight: 600 }}>%</span>
                </div>
              </label>
            ))}
          </div>
          {podeEditar && (
            <IonButton size="small" color="success" onClick={handleSalvarAliquotas} disabled={salvandoAliquotas}>
              {salvandoAliquotas ? 'Salvando…' : 'Salvar Alíquotas como Padrão da Cooperativa'}
            </IonButton>
          )}
        </div>
      )}

      {/* Simulador de custo por função (taxas completas) — continua aqui; na Proposta os impostos não são editáveis */}
      {abaAtiva === 'taxas' && (
        <CustoPorFuncaoSimulator
          taxas={params}
          cargosDisponiveis={listaCargosAtuais}
          modo="geral"
          podeEditarPadrao={podeEditar}
          onSalvarParametrosPadrao={salvarParametrosOficiais}
        />
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
