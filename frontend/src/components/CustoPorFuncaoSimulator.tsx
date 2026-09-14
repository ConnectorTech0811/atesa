import React, { useMemo, useState, useEffect } from 'react';
import { IonButton } from '@ionic/react';
import { formatarMoeda } from '../utils/formatters';

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

export interface FuncaoCalculada {
  cargo: string;
  tipo_escala: TipoEscalaPlanilha;
  salario_base: number;
  ajuda_custo: number;
  vr_dias: number;
  vt_dias: number;
  unitario_vt: number;
  diario_vr: number;
  adicional_noturno: boolean;
  periculosidade: boolean;
  peric_pct: number;
  insalubridade: 'NÃO' | 'BAIXO' | 'MÉDIO' | 'ALTO';
  premio_incentivo: number;
  dar_sim: boolean;
  abono_sim: boolean;
  quantidade: number;
  valor_vaga_cliente: number;
  valor_vaga_cooperado: number;
}

interface CustoPorFuncaoSimulatorProps {
  taxas?: Record<string, number>;
  cargosDisponiveis?: string[];
  modo?: 'proposta' | 'geral';
  onAdicionarFuncao?: (funcao: FuncaoCalculada) => void;
  onSalvarParametrosPadrao?: (parametros: Record<string, number>) => Promise<void>;
  podeEditarPadrao?: boolean;
}

export const CustoPorFuncaoSimulator: React.FC<CustoPorFuncaoSimulatorProps> = ({
  taxas = {},
  cargosDisponiveis = [],
  modo = 'proposta',
  onAdicionarFuncao,
  onSalvarParametrosPadrao,
  podeEditarPadrao = false,
}) => {
  // ── Estados do Simulador Custo por Função ───────────────────────────────────
  const [cargoSelecionado, setCargoSelecionado] = useState<string>(
    cargosDisponiveis.length > 0 ? cargosDisponiveis[0] : 'AUXILIAR DE ENFERMAGEM'
  );
  const [cargoCustom, setCargoCustom] = useState<string>('');
  const [escalaSel, setEscalaSel] = useState<TipoEscalaPlanilha>('PROCEDIMENTO');
  const [quantidadeVagas, setQuantidadeVagas] = useState<number>(1);
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

  // Alíquotas e Taxas aplicadas no Simulador (puxadas do banco central)
  const [taxaAdmPct, setTaxaAdmPct] = useState<number>(17.0);
  const [irrfFatPct, setIrrfFatPct] = useState<number>(1.50);
  const [pisPct, setPisPct] = useState<number>(0.65);
  const [cofinsPct, setCofinsPct] = useState<number>(3.00);
  const [issPct, setIssPct] = useState<number>(2.50);

  // Retenções do Cooperado
  const [seguroVidaValor, setSeguroVidaValor] = useState<number>(4.12);
  const [rateioCoopPct, setRateioCoopPct] = useState<number>(3.00);
  const [cotaParteValor, setCotaParteValor] = useState<number>(10.00);

  const [salvando, setSalvando] = useState(false);

  // Sincronizar parâmetros centrais vindos das props
  useEffect(() => {
    if (taxas) {
      if (taxas.taxa_adm !== undefined) setTaxaAdmPct(taxas.taxa_adm);
      if (taxas.irrf_geral !== undefined) setIrrfFatPct(taxas.irrf_geral);
      if (taxas.pis_rc !== undefined) setPisPct(taxas.pis_rc);
      else if (taxas.pis_percentual !== undefined) setPisPct(taxas.pis_percentual);
      if (taxas.cofins_rc !== undefined) setCofinsPct(taxas.cofins_rc);
      else if (taxas.cofins_percentual !== undefined) setCofinsPct(taxas.cofins_percentual);
      if (taxas.iss_geral !== undefined) setIssPct(taxas.iss_geral);
      else if (taxas.iss_percentual !== undefined) setIssPct(taxas.iss_percentual);

      if (taxas.seguro_vida_valor !== undefined) setSeguroVidaValor(Number(taxas.seguro_vida_valor) || 4.12);
      if (taxas.rateio_percentual !== undefined) setRateioCoopPct(taxas.rateio_percentual);
      if (taxas.cota_parte_integracao !== undefined) setCotaParteValor(Number(taxas.cota_parte_integracao) || 10.00);
    }
  }, [taxas]);

  useEffect(() => {
    if (cargosDisponiveis.length > 0 && !cargosDisponiveis.includes(cargoSelecionado) && cargoSelecionado !== '__outro__') {
      setCargoSelecionado(cargosDisponiveis[0]);
    }
  }, [cargosDisponiveis, cargoSelecionado]);

  // ── Atualização automática ao trocar a escala conforme padrão oficial ATESA ───
  const handleTrocarEscala = (novaEscala: TipoEscalaPlanilha) => {
    setEscalaSel(novaEscala);
    const upper = novaEscala.toUpperCase();

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

  // ── Motor de Cálculo Exato da Planilha Oficial ATESA ──────────────────────────
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
    const salarioMinimo = taxas.salario_minimo_base ?? 1621.0;
    let insolPct = 0.0;
    if (insalubridadeGrau === 'BAIXO') insolPct = (taxas.insalubridade_baixo ?? 10.0) / 100.0;
    else if (insalubridadeGrau === 'MÉDIO') insolPct = (taxas.insalubridade_medio ?? 20.0) / 100.0;
    else if (insalubridadeGrau === 'ALTO') insolPct = (taxas.insalubridade_alto ?? 40.0) / 100.0;

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
    const tetoInss = taxas.inss_teto ?? 8475.55;
    const inssAliq = (taxas.inss_cooperado_aliq ?? 20.0) / 100.0;
    const inssCoop = Math.round(Math.min(baseInss, tetoInss) * inssAliq * 100) / 100;

    const cotaParteCoop = cotaParteValor;

    // IRRF Cooperado com Dedução Simplificada
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
    taxaAdmPct, irrfFatPct, pisPct, cofinsPct, issPct, seguroVidaValor, rateioCoopPct, cotaParteValor, taxas,
  ]);

  const nomeCargoEfetivo = cargoSelecionado === '__outro__' ? cargoCustom : cargoSelecionado;

  const handleConfirmarAdicionar = () => {
    if (!onAdicionarFuncao) return;
    onAdicionarFuncao({
      cargo: nomeCargoEfetivo || 'FUNÇÃO PRESTADA',
      tipo_escala: escalaSel,
      salario_base: remuneracao,
      ajuda_custo: ajudaCusto,
      vr_dias: calculo.diasVr,
      vt_dias: calculo.diasVt,
      unitario_vt: unitarioVt,
      diario_vr: diarioVr,
      adicional_noturno: adNoturnoSim,
      periculosidade: periculosidadeSim,
      peric_pct: pericPctCustom,
      insalubridade: insalubridadeGrau,
      premio_incentivo: premioIncentivo,
      dar_sim: darSim,
      abono_sim: abonoSim,
      quantidade: quantidadeVagas,
      valor_vaga_cliente: calculo.totalCliente,
      valor_vaga_cooperado: calculo.liquidoCoop,
    });
  };

  const handleSalvarComoPadrao = async () => {
    if (!onSalvarParametrosPadrao) return;
    setSalvando(true);
    try {
      await onSalvarParametrosPadrao({
        taxa_adm: taxaAdmPct,
        irrf_geral: irrfFatPct,
        pis_rc: pisPct,
        cofins_rc: cofinsPct,
        iss_geral: issPct,
        seguro_vida_valor: seguroVidaValor,
        rateio_percentual: rateioCoopPct,
        cota_parte_integracao: cotaParteValor,
        salario_minimo_base: taxas.salario_minimo_base ?? 1621.0,
        inss_patronal: taxas.inss_patronal ?? 20.0,
        dar_pre: taxas.dar_pre ?? 8.33,
        inss_teto: taxas.inss_teto ?? 8475.55,
        inss_cooperado_aliq: taxas.inss_cooperado_aliq ?? 20.0,
        insalubridade_baixo: taxas.insalubridade_baixo ?? 10.0,
        insalubridade_medio: taxas.insalubridade_medio ?? 20.0,
        insalubridade_alto: taxas.insalubridade_alto ?? 40.0,
        periculosidade_sim: pericPctCustom ?? 30.0,
      });
    } finally {
      setSalvando(false);
    }
  };

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
  const td0: React.CSSProperties = { padding: '7px 10px', borderBottom: '1px solid #f0f0f0', verticalAlign: 'middle' };
  const td1: React.CSSProperties = { ...td0, background: '#f9f9f9' };

  return (
    <div style={{ marginBottom: 24 }}>
      {/* Banner Superior: CUSTO POR FUNÇÃO */}
      <div style={{ background: '#1b5e20', borderRadius: '8px 8px 0 0', padding: '10px 16px', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <span style={{ fontWeight: 800, fontSize: 13, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
          CUSTO POR FUNÇÃO
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, opacity: 0.9 }}>Cargo / Função:</span>
          <select
            value={cargoSelecionado}
            onChange={(e) => setCargoSelecionado(e.target.value)}
            style={{
              background: '#2e7d32', color: '#fff', border: '1px solid #81c784',
              borderRadius: 4, padding: '4px 10px', fontSize: 12, fontWeight: 700,
            }}
          >
            {cargosDisponiveis.map((c) => (
              <option key={c} value={c} style={{ background: '#fff', color: '#333' }}>{c}</option>
            ))}
            <option value="AUXILIAR DE ENFERMAGEM" style={{ background: '#fff', color: '#333' }}>AUXILIAR DE ENFERMAGEM</option>
            <option value="TÉCNICO DE ENFERMAGEM" style={{ background: '#fff', color: '#333' }}>TÉCNICO DE ENFERMAGEM</option>
            <option value="ENFERMEIRO" style={{ background: '#fff', color: '#333' }}>ENFERMEIRO</option>
            <option value="CUIDADOR" style={{ background: '#fff', color: '#333' }}>CUIDADOR</option>
            <option value="FONOAUDIÓLOGO" style={{ background: '#fff', color: '#333' }}>FONOAUDIÓLOGO</option>
            <option value="FISIOTERAPEUTA" style={{ background: '#fff', color: '#333' }}>FISIOTERAPEUTA</option>
            <option value="__outro__" style={{ background: '#fff', color: '#333' }}>✏️ Outro (digitar manual)</option>
          </select>

          {cargoSelecionado === '__outro__' && (
            <input
              type="text"
              placeholder="Nome do cargo/função"
              value={cargoCustom}
              onChange={(e) => setCargoCustom(e.target.value)}
              style={{
                background: '#fff', color: '#333', border: '1px solid #81c784',
                borderRadius: 4, padding: '4px 8px', fontSize: 12, width: 160,
              }}
            />
          )}
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
      <div style={{ background: '#fff', border: '1px solid #bbb', borderTop: 'none', padding: '20px', display: 'grid', gridTemplateColumns: '1.25fr 1fr', gap: 24, borderRadius: onAdicionarFuncao ? 0 : '0 0 8px 8px' }}>
        
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
                <span style={{ fontSize: 11, color: '#777' }}>Base R$ {(taxas.salario_minimo_base ?? 1621).toLocaleString('pt-BR')}</span>
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
                  <option value="BAIXO">BAIXO ({taxas.insalubridade_baixo ?? 10}%)</option>
                  <option value="MÉDIO">MÉDIO ({taxas.insalubridade_medio ?? 20}%)</option>
                  <option value="ALTO">ALTO ({taxas.insalubridade_alto ?? 40}%)</option>
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

          {/* Botão de Salvar Padrão para Administradores no Módulo Central */}
          {podeEditarPadrao && onSalvarParametrosPadrao && (
            <div style={{ marginTop: 16 }}>
              <IonButton
                size="small"
                color="success"
                disabled={salvando}
                onClick={handleSalvarComoPadrao}
              >
                {salvando ? 'Salvando…' : 'Salvar Alíquotas como Padrão da Cooperativa'}
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
              <span>INSS (20% até teto R$ {(taxas.inss_teto ?? 8475.55).toLocaleString('pt-BR')})</span>
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

      {/* ── BARRA DE AÇÃO: ADICIONAR ESTA FUNÇÃO À PROPOSTA (se em modo proposta) ── */}
      {onAdicionarFuncao && (
        <div style={{
          background: '#e8f5e9',
          border: '1px solid #bbb',
          borderTop: 'none',
          borderRadius: '0 0 8px 8px',
          padding: '14px 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#1b5e20' }}>
              Quantidade de Vagas:
            </span>
            <input
              type="number"
              min={1}
              max={999}
              value={quantidadeVagas}
              onChange={(e) => setQuantidadeVagas(Math.max(1, parseInt(e.target.value) || 1))}
              style={{
                width: 65,
                height: 34,
                textAlign: 'center',
                fontWeight: 700,
                fontSize: 14,
                borderRadius: 6,
                border: '1px solid #81c784',
                background: '#fff',
              }}
            />
            <span style={{ fontSize: 12, color: '#555' }}>
              Total Faturado: <strong>{formatarMoeda(calculo.totalCliente * quantidadeVagas)}</strong>
            </span>
          </div>

          <IonButton
            size="small"
            color="success"
            shape="round"
            onClick={handleConfirmarAdicionar}
            style={{ fontWeight: 700 }}
          >
            ➕ Incluir {nomeCargoEfetivo || 'Função'} na Proposta
          </IonButton>
        </div>
      )}

      {/* ── QUADRO INFORMATIVO: PROCEDIMENTOS & REGRAS DE CÁLCULO ───────── */}
      <div style={{ ...card, marginTop: 20 }}>
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
                Calculada sobre o Salário Mínimo legal (R$ {(taxas.salario_minimo_base ?? 1621).toLocaleString('pt-BR')},00):<br />
                • <strong>Sem risco:</strong> 0,0%<br />
                • <strong>Baixo:</strong> 10,0% (R$ {((taxas.salario_minimo_base ?? 1621) * 0.1).toFixed(2).replace('.', ',')})<br />
                • <strong>Médio:</strong> 20,0% (R$ {((taxas.salario_minimo_base ?? 1621) * 0.2).toFixed(2).replace('.', ',')})<br />
                • <strong>Alto:</strong> 40,0% (R$ {((taxas.salario_minimo_base ?? 1621) * 0.4).toFixed(2).replace('.', ',')})
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
              <td style={td0}><strong>Alíquota variável (Padrão {taxaAdmPct}%)</strong> incidente sobre o subtotal de remuneração e encargos.</td>
            </tr>
            <tr>
              <td style={{ ...td1, fontWeight: 700 }}>IMPOSTOS (PIS / COFINS / ISS)</td>
              <td style={td1}>Cálculo reverso <em>(Grossing up)</em> para embutir PIS ({pisPct}%), COFINS ({cofinsPct}%), ISS ({issPct}%) e IRRF ({irrfFatPct}%) no preço faturado ao cliente.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default CustoPorFuncaoSimulator;
