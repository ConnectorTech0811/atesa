import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { IonButton, useIonViewWillEnter } from '@ionic/react';
import { useToast } from '../../components/ToastContext';
import { usePermissoes } from '../../auth/PermissoesContext';
import { carregarTaxas, salvarCargos, salvarParametros } from '../../api/taxasApi';
import { formatarMoeda } from '../../utils/formatters';
import { IconBuilding, IconCheck, IconEdit, IconPlus, IconTrash } from '../../components/Icons';

// ── Tipos ─────────────────────────────────────────────────────────────────────

type Params = Record<string, number>;

export type TipoEscalaPlanilha =
  | 'PROCEDIMENTO'
  | 'PLANTÃO 12x36 DIURNO'
  | 'PLANTÃO 12x36 NOTURNO'
  | 'PLANTÃO 5X2 DIURNO'
  | 'PLANTÃO 5X2 NOTURNO'
  | 'MENSAL 6X1 DIURNO'
  | 'MENSAL 6X1 NOTURNO'
  | 'MENSAL 12X36 DIURNO'
  | 'MENSAL 12X36 NOTURNO'
  | 'MENSAL 5X2 DIURNO'
  | 'MENSAL 5X2 NOTURNO'
  | 'PLANTÃO 6X1 DIURNO'
  | 'PLANTÃO 6X1 NOTURNO'
  | 'PLANTÃO 24x48';

export const OPCOES_ESCALAS: TipoEscalaPlanilha[] = [
  'PROCEDIMENTO',
  'PLANTÃO 12x36 DIURNO',
  'PLANTÃO 12x36 NOTURNO',
  'PLANTÃO 5X2 DIURNO',
  'PLANTÃO 5X2 NOTURNO',
  'MENSAL 6X1 DIURNO',
  'MENSAL 6X1 NOTURNO',
  'MENSAL 12X36 DIURNO',
  'MENSAL 12X36 NOTURNO',
  'MENSAL 5X2 DIURNO',
  'MENSAL 5X2 NOTURNO',
  'PLANTÃO 6X1 DIURNO',
  'PLANTÃO 6X1 NOTURNO',
  'PLANTÃO 24x48',
];

// ── Estilos ───────────────────────────────────────────────────────────────────

const card: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #e0e0e0',
  borderRadius: 10,
  padding: '20px 22px',
  marginBottom: 20,
};

const sectionTitle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 700,
  color: '#222',
  borderBottom: '2px solid #c8e6c9',
  paddingBottom: 6,
  marginBottom: 14,
  marginTop: 0,
};

const table: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: 13 };
const th: React.CSSProperties = { background: '#f2f2f2', color: '#333', textAlign: 'left', padding: '7px 10px', fontWeight: 700, borderBottom: '2px solid #c8e6c9' };
const thR: React.CSSProperties = { ...th, textAlign: 'right' };
const td0: React.CSSProperties = { padding: '7px 10px', borderBottom: '1px solid #f0f0f0', verticalAlign: 'middle' };
const td1: React.CSSProperties = { ...td0, background: '#f9f9f9' };
const tdR0: React.CSSProperties = { ...td0, textAlign: 'right' };
const tdR1: React.CSSProperties = { ...td1, textAlign: 'right' };
const inputStyle: React.CSSProperties = { width: 100, textAlign: 'right', border: '1px solid #ccc', borderRadius: 4, padding: '3px 6px', fontSize: 13, fontFamily: 'inherit' };
const inputWide: React.CSSProperties = { ...inputStyle, width: 130 };
const textarea: React.CSSProperties = { width: '100%', minHeight: 200, border: '1px solid #ccc', borderRadius: 6, padding: 8, fontSize: 12, fontFamily: 'monospace', resize: 'vertical', boxSizing: 'border-box' };

// ── NumInput — campo numérico com edição local e commit no blur ───────────────

function NumInput({ value, onChange, wide, disabled }: { value: number; onChange: (v: number) => void; wide?: boolean; disabled?: boolean }) {
  const [local, setLocal] = useState(String(value));
  useEffect(() => { setLocal(String(value)); }, [value]);
  return (
    <input
      disabled={disabled}
      style={{ ... (wide ? inputWide : inputStyle), background: disabled ? '#f5f5f5' : '#fff', color: disabled ? '#888' : '#000' }}
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={() => {
        const n = parseFloat(local.replace(',', '.'));
        if (!isNaN(n)) onChange(n);
        else setLocal(String(value));
      }}
    />
  );
}

function Row({ label, chave, i, p, setP, wide }: { label: string; chave: string; i: number; p: Params; setP: (k: string, v: number) => void; wide?: boolean }) {
  return (
    <tr>
      <td style={i % 2 === 0 ? td0 : td1}>{label}</td>
      <td style={i % 2 === 0 ? tdR0 : tdR1}>
        <NumInput value={p[chave] ?? 0} onChange={(v) => setP(chave, v)} wide={wide} />
      </td>
    </tr>
  );
}

const COOPS = ['ATESA'];

// ── Componente principal ──────────────────────────────────────────────────────

function normalizarPct(val: any, padrao: number): number {
  if (val === undefined || val === null) return padrao;
  const n = Number(val);
  if (isNaN(n)) return padrao;
  // Se o valor estiver em formato fracionário/decimal (ex: 0.0065, 0.03, 0.025, 0.015, 0.17, 0.20), converte para percentual (0.65, 3.0, 2.5, 1.5, 17.0, 20.0)
  if (n > 0 && n < 0.5) return Number((n * 100).toFixed(4));
  return n;
}

const TaxasImpostos: React.FC = () => {
  const { showToast } = useToast();
  const { temPermissao } = usePermissoes();
  const [abaAtiva, setAbaAtiva] = useState<'simulador' | 'parametros'>('simulador');
  const [params, setParams] = useState<Params>({});
  const [cargos, setCargos] = useState<Record<string, string[]>>({});
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState<Record<string, boolean>>({});

  // ── Estados do Simulador Custo por Função (Planilha Oficial ATESA) ─────────
  const [cargoSelecionado, setCargoSelecionado] = useState('TÉCNICO DE ENFERMAGEM');
  const [escalaSel, setEscalaSel] = useState<TipoEscalaPlanilha>('PROCEDIMENTO');
  const [remuneracao, setRemuneracao] = useState<number>(30.0);
  const [ajudaCusto, setAjudaCusto] = useState<number>(0.0);
  const [unitarioVt, setUnitarioVt] = useState<number>(5.30);
  const [diarioVr, setDiarioVr] = useState<number>(25.0);
  const [adNoturnoSim, setAdNoturnoSim] = useState<boolean>(true);
  const [insalubridadeGrau, setInsalubridadeGrau] = useState<'NÃO' | 'BAIXO' | 'MÉDIO' | 'ALTO'>('NÃO');
  const [periculosidadeSim, setPericulosidadeSim] = useState<boolean>(true);
  const [pericPctCustom, setPericPctCustom] = useState<number>(30.0);
  const [premioIncentivo, setPremioIncentivo] = useState<number>(0.0);
  const [darSim, setDarSim] = useState<boolean>(false);
  const [abonoSim, setAbonoSim] = useState<boolean>(false);
  const [taxaAdmPct, setTaxaAdmPct] = useState<number>(17.0); // 17%
  const [irrfFatPct, setIrrfFatPct] = useState<number>(1.50); // 1.50%
  const [pisPct, setPisPct] = useState<number>(0.65); // 0.65%
  const [cofinsPct, setCofinsPct] = useState<number>(3.00); // 3.00%
  const [issPct, setIssPct] = useState<number>(2.50); // 2.50%

  // Retenções Cooperado Editáveis no Simulador
  const [seguroVidaValor, setSeguroVidaValor] = useState<number>(4.12);
  const [rateioCoopPct, setRateioCoopPct] = useState<number>(3.00);
  const [cotaParteValor, setCotaParteValor] = useState<number>(10.00);

  // ── Atualização automática ao trocar a escala ───────────────────────────────
  const handleTrocarEscala = (novaEscala: TipoEscalaPlanilha) => {
    setEscalaSel(novaEscala);
    const upper = novaEscala.toUpperCase();

    // Valores padrão sugeridos por escala conforme planilha
    if (upper === 'PROCEDIMENTO') {
      setRemuneracao(30.0);
      setUnitarioVt(5.30);
      setAdNoturnoSim(true);
      setDarSim(false);
      setAbonoSim(false);
      setInsalubridadeGrau('NÃO');
      setPericulosidadeSim(true);
      setPericPctCustom(30.0);
    } else if (upper.startsWith('PLANTÃO') || upper.startsWith('PLANTAO')) {
      setRemuneracao(100.0);
      setUnitarioVt(5.30);
      setDiarioVr(25.0);
      setDarSim(true);
      setAbonoSim(false);
      if (upper.includes('NOTURNO') || upper.includes('24X48')) {
        setAdNoturnoSim(true);
      } else {
        setAdNoturnoSim(false);
      }
      if (upper.includes('12X36')) {
        setInsalubridadeGrau('BAIXO');
        setPericulosidadeSim(false);
      } else {
        setInsalubridadeGrau('NÃO');
        setPericulosidadeSim(true);
      }
    } else if (upper.startsWith('MENSAL')) {
      setRemuneracao(1621.0);
      setUnitarioVt(5.30);
      setDiarioVr(25.0);
      setDarSim(true);
      setAbonoSim(false);
      if (upper.includes('NOTURNO')) {
        setAdNoturnoSim(true);
      } else {
        setAdNoturnoSim(false);
      }
      if (upper.includes('12X36') || upper.includes('5X2')) {
        setInsalubridadeGrau('MÉDIO');
        setPericulosidadeSim(false);
      } else {
        setInsalubridadeGrau('NÃO');
        setPericulosidadeSim(false);
      }
    }
  };

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const data = await carregarTaxas();
      if (data) {
        const raw = data.parametros || {};
        const p: Params = {};
        for (const [k, v] of Object.entries(raw)) {
          // Campos percentuais conhecidos
          if ([
            'pis_rnc', 'pis_rc', 'pis_esfl', 'cofins_rnc', 'cofins_rc', 'cofins_esfl',
            'iss_geral', 'irrf_geral', 'taxa_adm', 'inss_patronal', 'rateio_percentual',
            'inss_cooperado_aliq', 'iss_emissao_prestacao_sp', 'iss_emissao_prestacao_ce',
            'iss_emissao_prestacao_pe', 'iss_emissao_sp_prestacao_ce',
          ].includes(k)) {
            p[k] = normalizarPct(v, v);
          } else {
            p[k] = v;
          }
        }
        setParams(p);

        if (p.irrf_geral !== undefined) setIrrfFatPct(p.irrf_geral);
        if (p.pis_rc !== undefined) setPisPct(p.pis_rc);
        if (p.cofins_rc !== undefined) setCofinsPct(p.cofins_rc);
        if (p.iss_geral !== undefined) {
          // Planilha oficial da ATESA adota 2,50% como padrão de ISS
          const issNorm = (p.iss_geral === 2.0 || p.iss_geral === 0.02) ? 2.50 : p.iss_geral;
          setIssPct(issNorm);
          p.iss_geral = issNorm;
        } else {
          setIssPct(2.50);
          p.iss_geral = 2.50;
        }
        if (p.taxa_adm !== undefined) setTaxaAdmPct(p.taxa_adm);
        if (p.seguro_vida_valor !== undefined) setSeguroVidaValor(Number(p.seguro_vida_valor) || 4.12);
        if (p.rateio_percentual !== undefined) setRateioCoopPct(p.rateio_percentual);
        if (p.cota_parte_integracao !== undefined) setCotaParteValor(Number(p.cota_parte_integracao) || 10.00);

        const c: Record<string, string[]> = {};
        if (data.cargos) {
          for (const [coop, lista] of Object.entries(data.cargos)) {
            c[coop] = Array.isArray(lista) ? lista.map((x) => x.cargo) : [];
          }
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

  useIonViewWillEnter(() => { carregar(); });
  useEffect(() => { carregar(); }, [carregar]);

  const setP = (chave: string, valor: number) =>
    setParams((prev) => ({ ...prev, [chave]: valor }));

  const salvarGrupo = async (grupo: string, chaves: string[]) => {
    setSalvando((s) => ({ ...s, [grupo]: true }));
    const atualizacoes: Params = {};
    for (const k of chaves) atualizacoes[k] = params[k] ?? 0;
    try {
      await salvarParametros(atualizacoes);
      showToast('Salvo com sucesso!', 'success');
    } catch {
      showToast('Erro ao salvar. Tente novamente.', 'error');
    } finally {
      setSalvando((s) => ({ ...s, [grupo]: false }));
    }
  };

  const salvarParametrosDoSimulador = async () => {
    setSalvando((s) => ({ ...s, simulador: true }));
    try {
      await salvarParametros({
        irrf_geral: irrfFatPct,
        pis_rc: pisPct,
        cofins_rc: cofinsPct,
        iss_geral: issPct,
        taxa_adm: taxaAdmPct,
        seguro_vida_valor: seguroVidaValor,
        rateio_percentual: rateioCoopPct,
        cota_parte_integracao: cotaParteValor,
      });
      showToast('Parâmetros salvos no banco com sucesso!', 'success');
    } catch {
      showToast('Erro ao salvar parâmetros.', 'error');
    } finally {
      setSalvando((s) => ({ ...s, simulador: false }));
    }
  };

  const salvarCargosCoop = async (coop: string) => {
    setSalvando((s) => ({ ...s, [`cargos_${coop}`]: true }));
    try {
      await salvarCargos(coop, cargos[coop] ?? []);
      showToast('Cargos salvos com sucesso!', 'success');
    } catch {
      showToast('Erro ao salvar cargos.', 'error');
    } finally {
      setSalvando((s) => ({ ...s, [`cargos_${coop}`]: false }));
    }
  };

  const BtnSalvar = ({ grupo }: { grupo: string }) => {
    if (!temPermissao('taxas.editar')) return null;
    return (
      <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
        <IonButton
          size="small"
          color="primary"
          disabled={salvando[grupo]}
          onClick={() => {
            const chavesMapa: Record<string, string[]> = {
              pis_cofins:          ['pis_rnc', 'pis_rc', 'pis_esfl', 'cofins_rnc', 'cofins_rc', 'cofins_esfl'],
              impostos:            ['iss_geral', 'irrf_geral', 'taxa_adm', 'inss_patronal'],
              iss_estado:          ['iss_emissao_prestacao_sp', 'iss_emissao_prestacao_ce', 'iss_emissao_prestacao_pe', 'iss_emissao_sp_prestacao_ce'],
              cooperado_retencoes: ['salario_minimo_base', 'seguro_vida_valor', 'rateio_percentual', 'cota_parte_integracao', 'inss_teto', 'inss_cooperado_aliq'],
              inss_funcionario:    ['inss_func_faixa1_teto', 'inss_func_faixa1_aliq', 'inss_func_faixa2_teto', 'inss_func_faixa2_aliq', 'inss_func_faixa3_teto', 'inss_func_faixa3_aliq'],
              irrf_tabela:         ['irrf_f1_teto', 'irrf_f1_aliq', 'irrf_f1_parcela', 'irrf_f2_teto', 'irrf_f2_aliq', 'irrf_f2_parcela', 'irrf_f3_teto', 'irrf_f3_aliq', 'irrf_f3_parcela', 'irrf_f4_teto', 'irrf_f4_aliq', 'irrf_f4_parcela', 'irrf_f5_aliq', 'irrf_f5_parcela', 'irrf_dependente', 'irrf_desc_simplificado'],
              insalubridade:       ['insalubridade_baixo', 'insalubridade_medio', 'insalubridade_alto'],
              periculosidade:      ['periculosidade_sim'],
              dar:                 ['dar_pre', 'dar_pos'],
              abono_natalino:      ['abono_natalino_sim', 'abono_natalino_nao'],
              escala:              ['escala_procedimento', 'escala_plantao_12x36', 'escala_plantao_5x2', 'escala_mensal_6x1', 'escala_plantao_6x1', 'escala_mensal_5x2', 'escala_plantao_24x48', 'escala_mensal_12x36'],
              adnoturno:           ['adnoturno_procedimento_aliq', 'adnoturno_procedimento_base', 'adnoturno_plantao_12x36_aliq', 'adnoturno_plantao_12x36_base', 'adnoturno_plantao_5x2_aliq', 'adnoturno_plantao_5x2_base', 'adnoturno_mensal_6x1_aliq', 'adnoturno_mensal_6x1_base', 'adnoturno_plantao_6x1_aliq', 'adnoturno_plantao_6x1_base', 'adnoturno_mensal_5x2_aliq', 'adnoturno_mensal_5x2_base', 'adnoturno_plantao_24x48_aliq', 'adnoturno_plantao_24x48_base', 'adnoturno_mensal_12x36_aliq', 'adnoturno_mensal_12x36_base'],
            };
            if (grupo.startsWith('cargos_')) {
              salvarCargosCoop(grupo.replace('cargos_', ''));
            } else {
              salvarGrupo(grupo, chavesMapa[grupo] ?? []);
            }
          }}
        >
          {salvando[grupo] ? 'Salvando…' : 'Salvar'}
        </IonButton>
      </div>
    );
  };

  // ── Motor de Cálculo Exato da Planilha Oficial ATESA ──────────────────────
  const calculo = useMemo(() => {
    const esc = escalaSel.toUpperCase();

    // 1. Dias de VT e VR conforme a escala oficial
    let diasVt = 2;
    let diasVr = 0;
    if (esc.includes('MENSAL 12X36')) {
      diasVt = 15; diasVr = 15;
    } else if (esc.includes('MENSAL 5X2')) {
      diasVt = 21; diasVr = 21;
    } else if (esc.includes('MENSAL 6X1')) {
      diasVt = 26; diasVr = 26;
    } else if (esc.includes('PLANTÃO') || esc.includes('PLANTAO')) {
      diasVt = 2; diasVr = 1;
    } else { // PROCEDIMENTO
      diasVt = 2; diasVr = 0;
    }

    const vtTotal = unitarioVt * diasVt;
    const vrTotal = diasVr > 0 ? diarioVr * diasVr : 0;

    // 2. Insalubridade
    const salarioMinimo = params.salario_minimo_base ?? 1621.0;
    let insolPct = 0.0;
    if (insalubridadeGrau === 'BAIXO') insolPct = 0.10;
    else if (insalubridadeGrau === 'MÉDIO') insolPct = 0.20;
    else if (insalubridadeGrau === 'ALTO') insolPct = 0.40;

    const baseInsol = Math.min(remuneracao, salarioMinimo);
    const insolVal = baseInsol * insolPct;

    // 3. Periculosidade (se tiver insalubridade, periculosidade é 0)
    let pericPct = 0.0;
    let pericVal = 0.0;
    if (insolVal === 0 && periculosidadeSim) {
      pericPct = pericPctCustom / 100.0;
      pericVal = remuneracao * pericPct;
    }

    // 4. Adicional Noturno
    const baseAdnot = remuneracao + insolVal + pericVal;
    let adnotVal = 0.0;
    if (adNoturnoSim) {
      if (esc.includes('MENSAL 12X36')) {
        adnotVal = ((baseAdnot / 180.0) * 8.0 * 15.0) * 0.20;
      } else if (esc.includes('MENSAL 5X2')) {
        adnotVal = ((baseAdnot / 220.0) * 8.0 * 21.0) * 0.20;
      } else if (esc.includes('MENSAL 6X1')) {
        adnotVal = ((baseAdnot / 220.0) * 8.0 * 26.0) * 0.20;
      } else if (esc.includes('5X2')) {
        adnotVal = ((baseAdnot / 8.8) * 8.0) * 0.20;
      } else if (esc.includes('6X1')) {
        adnotVal = ((baseAdnot / 7.33) * 8.0) * 0.20;
      } else if (esc.includes('24X48')) {
        adnotVal = ((baseAdnot / 24.0) * 8.0) * 0.20;
      } else { // PROCEDIMENTO ou 12X36
        adnotVal = ((baseAdnot / 12.0) * 8.0) * 0.20;
      }
    }

    // 5. DAR & Abono
    const baseDar = remuneracao + adnotVal + insolVal + pericVal;
    const darVal = darSim ? (baseDar / 12.0) * 1.333 : 0.0;
    const abonoVal = abonoSim ? (baseDar + premioIncentivo) / 12.0 : 0.0;

    // 6. Taxa Adm Faturamento
    const somaD7D16 = remuneracao + ajudaCusto + vtTotal + vrTotal + adnotVal + insolVal + pericVal + premioIncentivo + darVal + abonoVal;
    const taxaAdmAliq = taxaAdmPct / 100.0;
    const taxaAdmVal = somaD7D16 * taxaAdmAliq;

    // 7. IRRF Faturamento (1.50% padrão)
    const irrfFatAliq = irrfFatPct / 100.0;
    const baseIrrfFat = remuneracao + adnotVal + insolVal + pericVal + darVal + abonoVal;
    const irrfFatVal = baseIrrfFat * irrfFatAliq;

    // 8. Impostos com Gross-Up (PIS 0.65%, COFINS 3.00%, ISS 2.50%)
    const pisAliq = pisPct / 100.0;
    const cofinsAliq = cofinsPct / 100.0;
    const issAliq = issPct / 100.0;

    const subtotalD7D17 = somaD7D16 + taxaAdmVal;
    const somaPisCofinsIss = (pisAliq + cofinsAliq + issAliq) * 100.0;

    let pisVal = 0.0;
    let cofinsVal = 0.0;
    let issVal = 0.0;

    if (subtotalD7D17 > 0) {
      const baseSemIrrf = (subtotalD7D17 / (100.0 - somaPisCofinsIss)) * 100.0;
      const irrfPctEfetivo = (irrfFatVal / baseSemIrrf) * 100.0;
      const denominador = 100.0 - (somaPisCofinsIss + irrfPctEfetivo);
      const grossBase = (subtotalD7D17 / denominador) * 100.0;
      pisVal = grossBase * pisAliq;
      cofinsVal = grossBase * cofinsAliq;
      issVal = grossBase * issAliq;
    }

    const totalCliente = subtotalD7D17 + irrfFatVal + pisVal + cofinsVal + issVal;

    // ── 9. Demonstrativo do Cooperado (Lado Direito) ──────────────────────────
    const totalBrutoCoop = remuneracao + ajudaCusto + vtTotal + vrTotal + pericVal + insolVal + adnotVal + premioIncentivo;

    const seguroVidaCoop = seguroVidaValor;
    const rateioAliq = rateioCoopPct / 100.0;
    const rateioCoop = totalBrutoCoop * rateioAliq;

    const baseInss = remuneracao + pericVal + insolVal + adnotVal;
    const tetoInss = params.inss_teto ?? 8475.55;
    const inssAliq = (params.inss_cooperado_aliq ?? 20.0) / 100.0;
    const inssCoop = Math.round(Math.min(baseInss, tetoInss) * inssAliq * 100) / 100;

    const cotaParteCoop = cotaParteValor;

    // IRRF Cooperado
    const baseIrrfCoop = baseInss - inssCoop;
    let irrfTab = 0.0;
    if (baseIrrfCoop <= 2428.80) {
      irrfTab = 0.0;
    } else if (baseIrrfCoop <= 2826.65) {
      irrfTab = baseIrrfCoop * 0.075 - 182.16;
    } else if (baseIrrfCoop <= 3751.05) {
      irrfTab = baseIrrfCoop * 0.150 - 394.16;
    } else if (baseIrrfCoop <= 4664.68) {
      irrfTab = baseIrrfCoop * 0.225 - 675.49;
    } else {
      irrfTab = baseIrrfCoop * 0.275 - 908.73;
    }

    let deducaoSimpl = 0.0;
    if (baseInss <= 5000.0) {
      deducaoSimpl = 312.89;
    } else if (baseInss <= 7350.0) {
      deducaoSimpl = 978.62 - 0.133145 * baseInss;
    }

    const irrfCoop = Math.round(Math.max(0.0, irrfTab - deducaoSimpl) * 100) / 100;

    const totalDescontosCoop = seguroVidaCoop + rateioCoop + inssCoop + cotaParteCoop + irrfCoop;
    const liquidoCoop = totalBrutoCoop - totalDescontosCoop;

    return {
      diasVt, diasVr, vtTotal, vrTotal, insolPct, insolVal, pericPct, pericVal,
      adnotVal, darVal, abonoVal, taxaAdmVal, irrfFatVal, pisVal, cofinsVal, issVal,
      totalCliente, totalBrutoCoop, seguroVidaCoop, rateioCoop, inssCoop, cotaParteCoop,
      irrfCoop, liquidoCoop,
    };
  }, [
    escalaSel, remuneracao, ajudaCusto, unitarioVt, diarioVr, adNoturnoSim,
    insalubridadeGrau, periculosidadeSim, pericPctCustom, premioIncentivo, darSim, abonoSim,
    taxaAdmPct, irrfFatPct, pisPct, cofinsPct, issPct, seguroVidaValor, rateioCoopPct, cotaParteValor, params,
  ]);

  if (carregando) return (
    <div style={{ padding: 40, textAlign: 'center', color: '#888', fontSize: 14 }}>
      Carregando taxas e impostos…
    </div>
  );

  const listaCargosAtuais = cargos['ATESA'] ?? [];

  // Estilos de célula idênticos à planilha Excel
  const cellInputBox: React.CSSProperties = {
    background: '#b0bec5',
    color: '#000',
    border: '1px solid #78909c',
    borderRadius: 3,
    padding: '3px 6px',
    textAlign: 'right',
    fontWeight: 700,
    fontSize: 13,
    boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.15)',
  };

  const cellInputWhite: React.CSSProperties = {
    background: '#ffffff',
    color: '#000',
    border: '1px solid #90a4ae',
    borderRadius: 3,
    padding: '3px 6px',
    textAlign: 'right',
    fontSize: 13,
  };

  const cellSelectBox: React.CSSProperties = {
    background: '#b0bec5',
    color: '#1a237e',
    border: '1px solid #78909c',
    borderRadius: 3,
    padding: '3px 6px',
    fontWeight: 700,
    fontSize: 12,
    cursor: 'pointer',
  };

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1120, margin: '0 auto' }}>

      {/* Cabeçalho */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: '#222', margin: 0 }}>Taxas e Impostos</h2>
          <p style={{ fontSize: 13, color: '#666', marginTop: 4 }}>
            Fórmulas, simulação e parâmetros oficiais da Cooperativa ATESA.
          </p>
        </div>
      </div>

      {/* Conteúdo Principal: Simulador Custo por Função (Planilha Oficial) */}
      <div>
          {/* Banner Superior: CUSTO POR FUNÇÃO */}
          <div style={{ background: '#1b5e20', borderRadius: '8px 8px 0 0', padding: '10px 16px', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 800, fontSize: 13, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              CUSTO POR FUNÇÃO
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 12, opacity: 0.9 }}>Cargo / Função:</span>
              <select
                value={cargoSelecionado}
                onChange={(e) => setCargoSelecionado(e.target.value)}
                style={{
                  background: '#2e7d32', color: '#fff', border: '1px solid #81c784',
                  borderRadius: 4, padding: '4px 10px', fontSize: 12, fontWeight: 700,
                }}
              >
                {listaCargosAtuais.map((c) => (
                  <option key={c} value={c} style={{ background: '#fff', color: '#333' }}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Cards de Resumo: CLIENTE vs. COOPERADO */}
          <div style={{ background: '#f5f5f5', border: '1px solid #bbb', borderTop: 'none', padding: '16px 20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            <div style={{ background: '#fff', border: '2px solid #333', borderRadius: 8, padding: '12px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: '#333', textTransform: 'uppercase' }}>CLIENTE</span>
              <span style={{ fontSize: 24, fontWeight: 900, color: '#1b5e20' }}>
                {formatarMoeda(calculo.totalCliente)}
              </span>
            </div>
            <div style={{ background: '#fff', border: '2px solid #333', borderRadius: 8, padding: '12px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: '#333', textTransform: 'uppercase' }}>COOPERADO</span>
              <span style={{ fontSize: 24, fontWeight: 900, color: '#1565c0' }}>
                {formatarMoeda(calculo.liquidoCoop)}
              </span>
            </div>
          </div>

          {/* Tabela Interativa de 2 Colunas (CLIENTE e COOPERADO) estilo Excel */}
          <div style={{ background: '#fff', border: '1px solid #bbb', borderTop: 'none', padding: '20px', display: 'grid', gridTemplateColumns: '1.25fr 1fr', gap: 24, borderRadius: '0 0 8px 8px', marginBottom: 24 }}>
            
            {/* ── COLUNA ESQUERDA: CLIENTE (FATURAMENTO) ─────────────────────── */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, borderBottom: '2px solid #a5d6a7', paddingBottom: 6 }}>
                <h4 style={{ margin: 0, fontSize: 13, fontWeight: 800, color: '#1b5e20', textTransform: 'uppercase' }}>
                  Detalhamento do Custo / Faturamento (Cliente)
                </h4>
                <span style={{ fontSize: 11, color: '#555' }}>Campos cinzas são editáveis</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
                
                {/* 1. Remuneração */}
                <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr 100px', alignItems: 'center', gap: 8, padding: '5px 8px', background: '#fafafa', borderRadius: 4 }}>
                  <span style={{ fontWeight: 600 }}>REMUNERAÇÃO</span>
                  <select
                    value={escalaSel}
                    onChange={(e) => handleTrocarEscala(e.target.value as TipoEscalaPlanilha)}
                    style={{ ...cellSelectBox, height: 32 }}
                  >
                    {OPCOES_ESCALAS.map((esc) => (
                      <option key={esc} value={esc}>{esc}</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    step="0.01"
                    style={{ ...cellInputBox, width: '100%', height: 30 }}
                    value={remuneracao}
                    onChange={(e) => setRemuneracao(parseFloat(e.target.value) || 0)}
                  />
                </div>

                {/* 2. Ajuda de Custo */}
                <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr 100px', alignItems: 'center', gap: 8, padding: '5px 8px' }}>
                  <span>AJUDA DE CUSTO</span>
                  <span style={{ fontSize: 11, color: '#888' }}>Valor livre</span>
                  <input
                    type="number"
                    step="0.01"
                    style={{ ...cellInputBox, width: '100%', height: 30 }}
                    value={ajudaCusto}
                    onChange={(e) => setAjudaCusto(parseFloat(e.target.value) || 0)}
                  />
                </div>

                {/* 3. Auxílio Transporte */}
                <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr 100px', alignItems: 'center', gap: 8, padding: '5px 8px', background: '#fafafa', borderRadius: 4 }}>
                  <div>
                    <span style={{ display: 'block', fontWeight: 600 }}>AUXÍLIO TRANSPORTE</span>
                    <span style={{ fontSize: 11, color: '#777' }}>× {calculo.diasVt} dias</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 11, color: '#666' }}>Unit:</span>
                    <input
                      type="number"
                      step="0.10"
                      style={{ ...cellInputBox, width: 75, height: 28 }}
                      value={unitarioVt}
                      onChange={(e) => setUnitarioVt(parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <span style={{ textAlign: 'right', fontWeight: 700 }}>
                    {formatarMoeda(calculo.vtTotal)}
                  </span>
                </div>

                {/* 4. Auxílio Refeição */}
                <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr 100px', alignItems: 'center', gap: 8, padding: '5px 8px' }}>
                  <div>
                    <span style={{ display: 'block', fontWeight: 600 }}>AUXÍLIO REFEIÇÃO</span>
                    <span style={{ fontSize: 11, color: '#777' }}>
                      {calculo.diasVr > 0 ? `× ${calculo.diasVr} dias` : 'Não aplicável'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 11, color: '#666' }}>Diária:</span>
                    <input
                      type="number"
                      step="1.00"
                      disabled={calculo.diasVr === 0}
                      style={{ ...cellInputBox, width: 75, height: 28, opacity: calculo.diasVr === 0 ? 0.4 : 1 }}
                      value={diarioVr}
                      onChange={(e) => setDiarioVr(parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <span style={{ textAlign: 'right', fontWeight: 700 }}>
                    {calculo.vrTotal > 0 ? formatarMoeda(calculo.vrTotal) : '-'}
                  </span>
                </div>

                {/* 5. Adicional Noturno */}
                <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr 100px', alignItems: 'center', gap: 8, padding: '5px 8px', background: '#fafafa', borderRadius: 4 }}>
                  <div>
                    <span style={{ display: 'block', fontWeight: 600 }}>ADICIONAL NOTURNO</span>
                    <span style={{ fontSize: 11, color: '#777' }}>Fórmula escala (20%)</span>
                  </div>
                  <select
                    value={adNoturnoSim ? 'SIM' : 'NÃO'}
                    onChange={(e) => setAdNoturnoSim(e.target.value === 'SIM')}
                    style={{ ...cellSelectBox, height: 30, width: 90 }}
                  >
                    <option value="SIM">SIM</option>
                    <option value="NÃO">NÃO</option>
                  </select>
                  <span style={{ textAlign: 'right', fontWeight: 700 }}>
                    {calculo.adnotVal > 0 ? formatarMoeda(calculo.adnotVal) : '-'}
                  </span>
                </div>

                {/* 6. Insalubridade */}
                <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr 100px', alignItems: 'center', gap: 8, padding: '5px 8px' }}>
                  <div>
                    <span style={{ display: 'block', fontWeight: 600 }}>INSALUBRIDADE</span>
                    <span style={{ fontSize: 11, color: '#777' }}>Base R$ 1.621</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <select
                      value={insalubridadeGrau}
                      onChange={(e) => {
                        const v = e.target.value as any;
                        setInsalubridadeGrau(v);
                        if (v !== 'NÃO') setPericulosidadeSim(false);
                      }}
                      style={{ ...cellSelectBox, height: 30, fontSize: 11 }}
                    >
                      <option value="NÃO">NÃO (0%)</option>
                      <option value="BAIXO">BAIXO (10%)</option>
                      <option value="MÉDIO">MÉDIO (20%)</option>
                      <option value="ALTO">ALTO (40%)</option>
                    </select>
                    <span style={{ fontSize: 11, color: '#666' }}>
                      {(calculo.insolPct * 100).toFixed(1)}%
                    </span>
                  </div>
                  <span style={{ textAlign: 'right', fontWeight: 700 }}>
                    {calculo.insolVal > 0 ? formatarMoeda(calculo.insolVal) : '-'}
                  </span>
                </div>

                {/* 7. Periculosidade */}
                <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr 100px', alignItems: 'center', gap: 8, padding: '5px 8px', background: '#fafafa', borderRadius: 4 }}>
                  <div>
                    <span style={{ display: 'block', fontWeight: 600 }}>PERICULOSIDADE</span>
                    <span style={{ fontSize: 11, color: '#777' }}>Sobre Remuneração</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <select
                      value={periculosidadeSim ? 'SIM' : 'NÃO'}
                      disabled={calculo.insolVal > 0}
                      onChange={(e) => setPericulosidadeSim(e.target.value === 'SIM')}
                      style={{ ...cellSelectBox, height: 30, width: 80, opacity: calculo.insolVal > 0 ? 0.4 : 1 }}
                    >
                      <option value="SIM">SIM</option>
                      <option value="NÃO">NÃO</option>
                    </select>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <input
                        type="number"
                        step="1"
                        disabled={!periculosidadeSim || calculo.insolVal > 0}
                        style={{ ...cellInputWhite, width: 50, height: 26, opacity: (!periculosidadeSim || calculo.insolVal > 0) ? 0.4 : 1 }}
                        value={pericPctCustom}
                        onChange={(e) => setPericPctCustom(parseFloat(e.target.value) || 0)}
                      />
                      <span style={{ fontSize: 11 }}>%</span>
                    </div>
                  </div>
                  <span style={{ textAlign: 'right', fontWeight: 700 }}>
                    {calculo.pericVal > 0 ? formatarMoeda(calculo.pericVal) : '-'}
                  </span>
                </div>

                {/* 8. Prêmio Incentivo */}
                <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr 100px', alignItems: 'center', gap: 8, padding: '5px 8px' }}>
                  <span>PRÊMIO INCENTIVO</span>
                  <span style={{ fontSize: 11, color: '#888' }}>Valor digitado</span>
                  <input
                    type="number"
                    step="10.00"
                    style={{ ...cellInputBox, width: '100%', height: 30 }}
                    value={premioIncentivo}
                    onChange={(e) => setPremioIncentivo(parseFloat(e.target.value) || 0)}
                  />
                </div>

                {/* 9. D.A.R. */}
                <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr 100px', alignItems: 'center', gap: 8, padding: '5px 8px', background: '#fafafa', borderRadius: 4 }}>
                  <div>
                    <span style={{ display: 'block', fontWeight: 600 }}>D.A.R.</span>
                    <span style={{ fontSize: 11, color: '#777' }}>Fator anual (÷12 × 1.333)</span>
                  </div>
                  <select
                    value={darSim ? 'SIM' : 'NÃO'}
                    onChange={(e) => setDarSim(e.target.value === 'SIM')}
                    style={{ ...cellSelectBox, height: 30, width: 80 }}
                  >
                    <option value="SIM">SIM</option>
                    <option value="NÃO">NÃO</option>
                  </select>
                  <span style={{ textAlign: 'right', fontWeight: 700 }}>
                    {calculo.darVal > 0 ? formatarMoeda(calculo.darVal) : '-'}
                  </span>
                </div>

                {/* 10. Abono Natalino */}
                <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr 100px', alignItems: 'center', gap: 8, padding: '5px 8px' }}>
                  <div>
                    <span style={{ display: 'block', fontWeight: 600 }}>ABONO NATALINO</span>
                    <span style={{ fontSize: 11, color: '#777' }}>Provisão (÷12)</span>
                  </div>
                  <select
                    value={abonoSim ? 'SIM' : 'NÃO'}
                    onChange={(e) => setAbonoSim(e.target.value === 'SIM')}
                    style={{ ...cellSelectBox, height: 30, width: 80 }}
                  >
                    <option value="SIM">SIM</option>
                    <option value="NÃO">NÃO</option>
                  </select>
                  <span style={{ textAlign: 'right', fontWeight: 700 }}>
                    {calculo.abonoVal > 0 ? formatarMoeda(calculo.abonoVal) : '-'}
                  </span>
                </div>

                {/* 11. Taxa Administrativa */}
                <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr 100px', alignItems: 'center', gap: 8, padding: '5px 8px', background: '#fafafa', borderRadius: 4 }}>
                  <span style={{ fontWeight: 600 }}>TAXA ADMINISTRATIVA</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <input
                      type="number"
                      step="0.5"
                      style={{ ...cellInputBox, width: 75, height: 28 }}
                      value={taxaAdmPct}
                      onChange={(e) => setTaxaAdmPct(parseFloat(e.target.value) || 0)}
                    />
                    <span style={{ fontSize: 12, fontWeight: 700 }}>%</span>
                  </div>
                  <span style={{ textAlign: 'right', fontWeight: 700 }}>
                    {formatarMoeda(calculo.taxaAdmVal)}
                  </span>
                </div>

                {/* 12. IRRF Faturamento */}
                <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr 100px', alignItems: 'center', gap: 8, padding: '5px 8px' }}>
                  <span>IRRF FATURAMENTO</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <input
                      type="number"
                      step="0.10"
                      style={{ ...cellInputWhite, width: 70, height: 26 }}
                      value={irrfFatPct}
                      onChange={(e) => setIrrfFatPct(parseFloat(e.target.value) || 0)}
                    />
                    <span style={{ fontSize: 12 }}>%</span>
                  </div>
                  <span style={{ textAlign: 'right', fontWeight: 600 }}>
                    {formatarMoeda(calculo.irrfFatVal)}
                  </span>
                </div>

                {/* 13. PIS */}
                <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr 100px', alignItems: 'center', gap: 8, padding: '5px 8px', background: '#fafafa', borderRadius: 4 }}>
                  <span>PIS</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <input
                      type="number"
                      step="0.05"
                      style={{ ...cellInputWhite, width: 70, height: 26 }}
                      value={pisPct}
                      onChange={(e) => setPisPct(parseFloat(e.target.value) || 0)}
                    />
                    <span style={{ fontSize: 12 }}>%</span>
                  </div>
                  <span style={{ textAlign: 'right', fontWeight: 600 }}>
                    {formatarMoeda(calculo.pisVal)}
                  </span>
                </div>

                {/* 14. COFINS */}
                <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr 100px', alignItems: 'center', gap: 8, padding: '5px 8px' }}>
                  <span>COFINS</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <input
                      type="number"
                      step="0.10"
                      style={{ ...cellInputWhite, width: 70, height: 26 }}
                      value={cofinsPct}
                      onChange={(e) => setCofinsPct(parseFloat(e.target.value) || 0)}
                    />
                    <span style={{ fontSize: 12 }}>%</span>
                  </div>
                  <span style={{ textAlign: 'right', fontWeight: 600 }}>
                    {formatarMoeda(calculo.cofinsVal)}
                  </span>
                </div>

                {/* 15. ISS */}
                <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr 100px', alignItems: 'center', gap: 8, padding: '5px 8px', background: '#fafafa', borderRadius: 4 }}>
                  <span style={{ color: '#0d47a1', fontWeight: 600 }}>ISS</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <input
                      type="number"
                      step="0.10"
                      style={{ ...cellInputWhite, width: 70, height: 26 }}
                      value={issPct}
                      onChange={(e) => setIssPct(parseFloat(e.target.value) || 0)}
                    />
                    <span style={{ fontSize: 12 }}>%</span>
                  </div>
                  <span style={{ textAlign: 'right', fontWeight: 600 }}>
                    {formatarMoeda(calculo.issVal)}
                  </span>
                </div>

              </div>

              {/* Botão de Salvar Parâmetros do Simulador */}
              {temPermissao('taxas.editar') && (
                <div style={{ marginTop: 16 }}>
                  <IonButton
                    size="small"
                    color="success"
                    disabled={salvando.simulador}
                    onClick={salvarParametrosDoSimulador}
                  >
                    {salvando.simulador ? 'Salvando…' : 'Salvar Alíquotas como Padrão da Cooperativa'}
                  </IonButton>
                </div>
              )}
            </div>

            {/* ── COLUNA DIREITA: COOPERADO (LÍQUIDO & RETENÇÕES) ─────────────── */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, borderBottom: '2px solid #90caf9', paddingBottom: 6 }}>
                <h4 style={{ margin: 0, fontSize: 13, fontWeight: 800, color: '#1565c0', textTransform: 'uppercase' }}>
                  Demonstrativo do Cooperado (Proventos & Retenções)
                </h4>
                <span style={{ fontSize: 11, color: '#555' }}>Proventos e Descontos</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 8px', background: '#f5f9ff', borderRadius: 4 }}>
                  <span>REMUNERAÇÃO BRUTA</span>
                  <span style={{ fontWeight: 700 }}>{formatarMoeda(remuneracao)}</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 8px' }}>
                  <span>AJUDA DE CUSTO</span>
                  <span style={{ fontWeight: 600 }}>{ajudaCusto > 0 ? formatarMoeda(ajudaCusto) : '-'}</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 8px', background: '#f5f9ff', borderRadius: 4 }}>
                  <span>AUXÍLIO TRANSPORTE</span>
                  <span style={{ fontWeight: 600 }}>{calculo.vtTotal > 0 ? formatarMoeda(calculo.vtTotal) : '-'}</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 8px' }}>
                  <span>AUXÍLIO REFEIÇÃO</span>
                  <span style={{ fontWeight: 600 }}>{calculo.vrTotal > 0 ? formatarMoeda(calculo.vrTotal) : '-'}</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 8px', background: '#f5f9ff', borderRadius: 4 }}>
                  <span>PERICULOSIDADE</span>
                  <span style={{ fontWeight: 600 }}>{calculo.pericVal > 0 ? formatarMoeda(calculo.pericVal) : '-'}</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 8px' }}>
                  <span>INSALUBRIDADE</span>
                  <span style={{ fontWeight: 600 }}>{calculo.insolVal > 0 ? formatarMoeda(calculo.insolVal) : '-'}</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 8px', background: '#f5f9ff', borderRadius: 4 }}>
                  <span>ADICIONAL NOTURNO</span>
                  <span style={{ fontWeight: 600 }}>{calculo.adnotVal > 0 ? formatarMoeda(calculo.adnotVal) : '-'}</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 8px' }}>
                  <span>PRÊMIO INCENTIVO</span>
                  <span style={{ fontWeight: 600 }}>{premioIncentivo > 0 ? formatarMoeda(premioIncentivo) : '-'}</span>
                </div>

                <div style={{ borderTop: '1px dashed #bbb', margin: '4px 0' }} />

                {/* Retenções Cooperado Editáveis */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 8px', color: '#c62828', background: '#fff8f8', borderRadius: 4 }}>
                  <span>SEGURO DE VIDA (fixo)</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 11 }}>R$</span>
                    <input
                      type="number"
                      step="0.01"
                      style={{ ...cellInputWhite, width: 65, height: 26, color: '#c62828', fontWeight: 700 }}
                      value={seguroVidaValor}
                      onChange={(e) => setSeguroVidaValor(parseFloat(e.target.value) || 0)}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 8px', color: '#c62828' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span>RATEIO</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <input
                        type="number"
                        step="0.5"
                        style={{ ...cellInputWhite, width: 50, height: 26, color: '#c62828' }}
                        value={rateioCoopPct}
                        onChange={(e) => setRateioCoopPct(parseFloat(e.target.value) || 0)}
                      />
                      <span style={{ fontSize: 11 }}>%</span>
                    </div>
                  </div>
                  <span style={{ fontWeight: 700 }}>- {formatarMoeda(calculo.rateioCoop)}</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 8px', color: '#c62828', background: '#fff8f8', borderRadius: 4 }}>
                  <span>INSS (20% até teto R$ 8.475,55)</span>
                  <span style={{ fontWeight: 700 }}>- {formatarMoeda(calculo.inssCoop)}</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 8px', color: '#c62828' }}>
                  <span>INTEGRAÇÃO COTA-PARTE</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 11 }}>R$</span>
                    <input
                      type="number"
                      step="1.00"
                      style={{ ...cellInputWhite, width: 65, height: 26, color: '#c62828', fontWeight: 700 }}
                      value={cotaParteValor}
                      onChange={(e) => setCotaParteValor(parseFloat(e.target.value) || 0)}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 8px', color: '#c62828', background: '#fff8f8', borderRadius: 4 }}>
                  <span>IRRF COOPERADO</span>
                  <span style={{ fontWeight: 700 }}>{calculo.irrfCoop > 0 ? `- ${formatarMoeda(calculo.irrfCoop)}` : '-'}</span>
                </div>

                <div style={{ borderTop: '2px solid #1565c0', paddingTop: 8, marginTop: 6, display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                  <strong style={{ color: '#1565c0' }}>TOTAL LÍQUIDO COOPERADO:</strong>
                  <strong style={{ fontSize: 16, color: '#1565c0' }}>{formatarMoeda(calculo.liquidoCoop)}</strong>
                </div>

              </div>
            </div>

          </div>

          {/* ── QUADRO INFORMATIVO: PROCEDIMENTOS & REGRAS DE CÁLCULO ───────── */}
          <div style={card}>
            <p style={{ ...sectionTitle, color: '#1b5e20' }}>Procedimento & Regras de Cálculo da Planilha Oficial ATESA</p>
            <table style={{ ...table, fontSize: 12 }}>
              <thead>
                <tr>
                  <th style={{ ...th, width: '25%' }}>Rubrica / Conceito</th>
                  <th style={th}>Procedimento e Regra de Cálculo</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ ...td0, fontWeight: 700 }}>REMUNERAÇÃO</td>
                  <td style={td0}>Valor base informado para a vaga ou plantão.</td>
                </tr>
                <tr>
                  <td style={{ ...td1, fontWeight: 700 }}>AJUDA DE CUSTO</td>
                  <td style={td1}>Valor livre informado conforme contrato/edital.</td>
                </tr>
                <tr>
                  <td style={{ ...td0, fontWeight: 700 }}>AUXÍLIO TRANSPORTE</td>
                  <td style={td0}><strong>VALOR UNITÁRIO × QUANTIDADES DE DIAS TRABALHADOS</strong> (2 passagens em plantões/procedimento; 15 dias em 12x36; 21 dias em 5x2; 26 dias em 6x1).</td>
                </tr>
                <tr>
                  <td style={{ ...td1, fontWeight: 700 }}>AUXÍLIO REFEIÇÃO</td>
                  <td style={td1}><strong>VALOR DIA × QUANTIDADES DE DIAS TRABALHADOS</strong> (1 diária em plantões; 15 dias em 12x36; 21 dias em 5x2; 26 dias em 6x1).</td>
                </tr>
                <tr>
                  <td style={{ ...td0, fontWeight: 700 }}>ADICIONAL NOTURNO</td>
                  <td style={td0}>
                    <strong>REMUNERAÇÃO ÷ HORAS TRABALHADAS = VALOR HORA</strong><br />
                    VALOR HORA × 8 HORAS DIA = VALOR DIA<br />
                    VALOR DIA × QUANTIDADES DE DIAS TRABALHADOS = VALOR MÊS<br />
                    VALOR MÊS × 20% = <strong>VALOR DO ADICIONAL NOTURNO</strong>
                  </td>
                </tr>
                <tr>
                  <td style={{ ...td1, fontWeight: 700 }}>INSALUBRIDADE</td>
                  <td style={td1}>
                    Calculada sobre o Salário Mínimo legal (R$ 1.621,00):<br />
                    • <strong>Sem risco:</strong> 0,0%<br />
                    • <strong>Baixo:</strong> 10,0% (R$ 162,10)<br />
                    • <strong>Médio:</strong> 20,0% (R$ 324,20)<br />
                    • <strong>Alto:</strong> 40,0% (R$ 648,40)
                  </td>
                </tr>
                <tr>
                  <td style={{ ...td0, fontWeight: 700 }}>PERICULOSIDADE</td>
                  <td style={td0}><strong>REMUNERAÇÃO × 30%</strong> (aplicável somente quando não houver insalubridade ativa).</td>
                </tr>
                <tr>
                  <td style={{ ...td1, fontWeight: 700 }}>PREMIO INCENTIVO</td>
                  <td style={td1}>Valor fixo digitado conforme premiação acordada.</td>
                </tr>
                <tr>
                  <td style={{ ...td0, fontWeight: 700 }}>D.A.R.</td>
                  <td style={td0}><strong>(REMUNERAÇÃO + AD.NOTURNO + INSALUBRIDADE + PERICULOSIDADE) ÷ 12 × 1,333</strong></td>
                </tr>
                <tr>
                  <td style={{ ...td1, fontWeight: 700 }}>ABONO NATALINO</td>
                  <td style={td1}><strong>(REMUNERAÇÃO + AD.NOTURNO + INSALUBRIDADE + PERICULOSIDADE + PRÊMIO) ÷ 12</strong></td>
                </tr>
                <tr>
                  <td style={{ ...td0, fontWeight: 700 }}>TAXA ADMINISTRATIVA</td>
                  <td style={td0}><strong>Alíquota variável (Padrão 17%)</strong> incidente sobre o subtotal de remuneração e encargos.</td>
                </tr>
                <tr>
                  <td style={{ ...td1, fontWeight: 700 }}>IMPOSTOS (PIS / COFINS / ISS)</td>
                  <td style={td1}>Cálculo reverso <em>(Grossing up)</em> para embutir PIS (0,65%), COFINS (3,00%), ISS (2,50%) e IRRF (1,50%) no preço faturado ao cliente.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
  );
};

export default TaxasImpostos;
