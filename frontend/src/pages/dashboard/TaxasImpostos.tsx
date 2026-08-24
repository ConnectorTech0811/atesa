import React, { useCallback, useEffect, useState } from 'react';
import { IonButton, useIonViewWillEnter } from '@ionic/react';
import { useToast } from '../../components/ToastContext';
import { carregarTaxas, salvarCargos, salvarParametros } from '../../api/taxasApi';

// ── Tipos ─────────────────────────────────────────────────────────────────────

type Params = Record<string, number>;

// ── Estilos reutilizados pelas outras páginas ─────────────────────────────────

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

function NumInput({ value, onChange, wide }: { value: number; onChange: (v: number) => void; wide?: boolean }) {
  const [local, setLocal] = useState(String(value));
  useEffect(() => { setLocal(String(value)); }, [value]);
  return (
    <input
      style={wide ? inputWide : inputStyle}
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

// ── Helpers de linha de tabela ─────────────────────────────────────────────────

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

// ── Componente principal ──────────────────────────────────────────────────────

const COOPS = ['ATESA'];

const TaxasImpostos: React.FC = () => {
  const { showToast } = useToast();
  const [params, setParams] = useState<Params>({});
  const [cargos, setCargos] = useState<Record<string, string[]>>({});
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState<Record<string, boolean>>({});

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const data = await carregarTaxas();
      setParams(data.parametros);
      const c: Record<string, string[]> = {};
      for (const [coop, lista] of Object.entries(data.cargos)) {
        c[coop] = lista.map((x) => x.cargo);
      }
      setCargos(c);
    } catch {
      showToast('Erro ao carregar taxas e impostos.', 'error');
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

  const BtnSalvar = ({ grupo }: { grupo: string }) => (
    <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
      <IonButton
        size="small"
        color="primary"
        disabled={salvando[grupo]}
        onClick={() => {
          const chavesMapa: Record<string, string[]> = {
            pis_cofins:        ['pis_rnc','pis_rc','pis_esfl','cofins_rnc','cofins_rc','cofins_esfl'],
            impostos:          ['iss_geral','irrf_geral','inss_patronal'],
            iss_estado:        ['iss_emissao_prestacao_sp','iss_emissao_prestacao_ce','iss_emissao_prestacao_pe','iss_emissao_sp_prestacao_ce'],
            inss_funcionario:  ['inss_func_faixa1_teto','inss_func_faixa1_aliq','inss_func_faixa2_teto','inss_func_faixa2_aliq','inss_func_faixa3_teto','inss_func_faixa3_aliq'],
            irrf_tabela:       ['irrf_f1_teto','irrf_f1_aliq','irrf_f1_parcela','irrf_f2_teto','irrf_f2_aliq','irrf_f2_parcela','irrf_f3_teto','irrf_f3_aliq','irrf_f3_parcela','irrf_f4_teto','irrf_f4_aliq','irrf_f4_parcela','irrf_f5_aliq','irrf_f5_parcela','irrf_dependente','irrf_desc_simplificado'],
            insalubridade:     ['insalubridade_baixo','insalubridade_medio','insalubridade_alto'],
            periculosidade:    ['periculosidade_sim'],
            dar:               ['dar_pre','dar_pos'],
            abono_natalino:    ['abono_natalino_sim','abono_natalino_nao'],
            vrvt:              ['vrvt_procedimento','vrvt_plantao_12x36','vrvt_plantao_5x2','vrvt_mensal_6x1','vrvt_mensal_12x36','vrvt_mensal_5x2','vrvt_plantao_6x1','vrvt_plantao_24x48'],
            escala:            ['escala_procedimento','escala_plantao_12x36','escala_plantao_5x2','escala_mensal_6x1','escala_plantao_6x1','escala_mensal_5x2','escala_plantao_24x48','escala_mensal_12x36'],
            adnoturno:         ['adnoturno_procedimento_aliq','adnoturno_procedimento_base','adnoturno_plantao_12x36_aliq','adnoturno_plantao_12x36_base','adnoturno_plantao_5x2_aliq','adnoturno_plantao_5x2_base','adnoturno_mensal_6x1_aliq','adnoturno_mensal_6x1_base','adnoturno_plantao_6x1_aliq','adnoturno_plantao_6x1_base','adnoturno_mensal_5x2_aliq','adnoturno_mensal_5x2_base','adnoturno_plantao_24x48_aliq','adnoturno_plantao_24x48_base','adnoturno_mensal_12x36_aliq','adnoturno_mensal_12x36_base'],
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

  const escalaLabels: [string, string][] = [
    ['procedimento',  'Procedimento'],
    ['plantao_12x36', 'Plantão 12x36'],
    ['plantao_5x2',   'Plantão 5x2'],
    ['mensal_6x1',    'Mensal 6x1'],
    ['mensal_12x36',  'Mensal 12x36'],
    ['mensal_5x2',    'Mensal 5x2'],
    ['plantao_6x1',   'Plantão 6x1'],
    ['plantao_24x48', 'Plantão 24x48'],
  ];

  if (carregando) return (
    <div style={{ padding: 40, textAlign: 'center', color: '#888', fontSize: 14 }}>
      Carregando taxas e impostos…
    </div>
  );

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1020, margin: '0 auto' }}>

      {/* Cabeçalho */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: '#222', margin: 0 }}>Taxas e Impostos</h2>
        <p style={{ fontSize: 13, color: '#666', marginTop: 4 }}>
          Parâmetros fiscais utilizados no cálculo das propostas comerciais. Altere e salve seção por seção.
        </p>
      </div>

      {/* ── PIS / COFINS ──────────────────────────────────────────────────── */}
      <div style={card}>
        <p style={sectionTitle}>Alíquotas PIS e COFINS</p>
        <table style={table}>
          <thead>
            <tr>
              <th style={th}>Tributo</th>
              <th style={thR}>Regime Normal Cumulativo (RNC)</th>
              <th style={thR}>Regime Cumulativo (RC)</th>
              <th style={thR}>ESFL</th>
            </tr>
          </thead>
          <tbody>
            {(['PIS','COFINS'] as const).map((t, i) => {
              const prefix = t.toLowerCase();
              return (
                <tr key={t}>
                  <td style={i % 2 === 0 ? td0 : td1}>{t}</td>
                  <td style={i % 2 === 0 ? tdR0 : tdR1}><NumInput value={params[`${prefix}_rnc`] ?? 0} onChange={(v) => setP(`${prefix}_rnc`, v)} /></td>
                  <td style={i % 2 === 0 ? tdR0 : tdR1}><NumInput value={params[`${prefix}_rc`] ?? 0} onChange={(v) => setP(`${prefix}_rc`, v)} /></td>
                  <td style={i % 2 === 0 ? tdR0 : tdR1}><NumInput value={params[`${prefix}_esfl`] ?? 0} onChange={(v) => setP(`${prefix}_esfl`, v)} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <BtnSalvar grupo="pis_cofins" />
      </div>

      {/* ── Impostos Gerais + ISS por Estado ──────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
        <div style={card}>
          <p style={sectionTitle}>Impostos Gerais</p>
          <table style={table}>
            <thead><tr><th style={th}>Tributo</th><th style={thR}>Alíquota</th></tr></thead>
            <tbody>
              {[['ISS (padrão)','iss_geral'],['IRRF (padrão)','irrf_geral'],['INSS Patronal','inss_patronal']].map(([l,k], i) => (
                <Row key={k} label={l} chave={k} i={i} p={params} setP={setP} />
              ))}
            </tbody>
          </table>
          <BtnSalvar grupo="impostos" />
        </div>

        <div style={card}>
          <p style={sectionTitle}>ISS por Estado de Emissão / Prestação</p>
          <table style={table}>
            <thead><tr><th style={th}>Situação</th><th style={thR}>Alíquota</th></tr></thead>
            <tbody>
              {[
                ['Emissão e Prestação SP','iss_emissao_prestacao_sp'],
                ['Emissão e Prestação CE','iss_emissao_prestacao_ce'],
                ['Emissão e Prestação PE','iss_emissao_prestacao_pe'],
                ['Emissão SP / Prestação CE','iss_emissao_sp_prestacao_ce'],
              ].map(([l,k], i) => (
                <Row key={k} label={l} chave={k} i={i} p={params} setP={setP} />
              ))}
            </tbody>
          </table>
          <BtnSalvar grupo="iss_estado" />
        </div>
      </div>

      {/* ── INSS Funcionário ──────────────────────────────────────────────── */}
      <div style={card}>
        <p style={sectionTitle}>INSS — Alíquota do Funcionário por Faixa Salarial</p>
        <table style={table}>
          <thead>
            <tr>
              <th style={th}>Faixa</th>
              <th style={thR}>Teto (R$)</th>
              <th style={thR}>Alíquota</th>
            </tr>
          </thead>
          <tbody>
            {([1,2,3] as const).map((f, i) => (
              <tr key={f}>
                <td style={i%2===0?td0:td1}>{f}ª faixa</td>
                <td style={i%2===0?tdR0:tdR1}><NumInput value={params[`inss_func_faixa${f}_teto`]??0} onChange={(v)=>setP(`inss_func_faixa${f}_teto`,v)} wide /></td>
                <td style={i%2===0?tdR0:tdR1}><NumInput value={params[`inss_func_faixa${f}_aliq`]??0} onChange={(v)=>setP(`inss_func_faixa${f}_aliq`,v)} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        <BtnSalvar grupo="inss_funcionario" />
      </div>

      {/* ── IRRF Tabela Progressiva ────────────────────────────────────────── */}
      <div style={card}>
        <p style={sectionTitle}>Tabela IRRF — Progressiva</p>
        <table style={table}>
          <thead>
            <tr>
              <th style={th}>Faixa</th>
              <th style={thR}>Teto (R$)</th>
              <th style={thR}>Alíquota</th>
              <th style={thR}>Parcela a deduzir (R$)</th>
            </tr>
          </thead>
          <tbody>
            {([1,2,3,4] as const).map((f, i) => (
              <tr key={f}>
                <td style={i%2===0?td0:td1}>{f}ª faixa</td>
                <td style={i%2===0?tdR0:tdR1}><NumInput value={params[`irrf_f${f}_teto`]??0} onChange={(v)=>setP(`irrf_f${f}_teto`,v)} wide /></td>
                <td style={i%2===0?tdR0:tdR1}><NumInput value={params[`irrf_f${f}_aliq`]??0} onChange={(v)=>setP(`irrf_f${f}_aliq`,v)} /></td>
                <td style={i%2===0?tdR0:tdR1}><NumInput value={params[`irrf_f${f}_parcela`]??0} onChange={(v)=>setP(`irrf_f${f}_parcela`,v)} wide /></td>
              </tr>
            ))}
            <tr>
              <td style={td1}>5ª faixa (acima do teto 4ª)</td>
              <td style={tdR1}>—</td>
              <td style={tdR1}><NumInput value={params['irrf_f5_aliq']??0} onChange={(v)=>setP('irrf_f5_aliq',v)} /></td>
              <td style={tdR1}><NumInput value={params['irrf_f5_parcela']??0} onChange={(v)=>setP('irrf_f5_parcela',v)} wide /></td>
            </tr>
          </tbody>
        </table>
        <div style={{ display: 'flex', gap: 32, marginTop: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <label style={{ fontSize: 13 }}>
            Dedução por dependente (R$)&nbsp;
            <NumInput value={params['irrf_dependente']??0} onChange={(v)=>setP('irrf_dependente',v)} wide />
          </label>
          <label style={{ fontSize: 13 }}>
            Desconto simplificado (R$)&nbsp;
            <NumInput value={params['irrf_desc_simplificado']??0} onChange={(v)=>setP('irrf_desc_simplificado',v)} wide />
          </label>
        </div>
        <BtnSalvar grupo="irrf_tabela" />
      </div>

      {/* ── Insalubridade / Periculosidade / D.A.R. / Abono ──────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
        <div style={card}>
          <p style={sectionTitle}>Insalubridade</p>
          <table style={table}>
            <thead><tr><th style={th}>Grau</th><th style={thR}>Alíquota (%)</th></tr></thead>
            <tbody>
              {[['Baixo / Pré','insalubridade_baixo'],['Médio','insalubridade_medio'],['Alto / Máxima','insalubridade_alto']].map(([l,k],i)=>(
                <Row key={k} label={l} chave={k} i={i} p={params} setP={setP} />
              ))}
            </tbody>
          </table>
          <BtnSalvar grupo="insalubridade" />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={card}>
            <p style={sectionTitle}>Periculosidade</p>
            <table style={table}>
              <thead><tr><th style={th}>Situação</th><th style={thR}>Alíquota (%)</th></tr></thead>
              <tbody>
                <tr><td style={td0}>Não aplicável</td><td style={tdR0}>0,00</td></tr>
                <tr><td style={td1}>Sim</td><td style={tdR1}><NumInput value={params['periculosidade_sim']??0} onChange={(v)=>setP('periculosidade_sim',v)} /></td></tr>
              </tbody>
            </table>
            <BtnSalvar grupo="periculosidade" />
          </div>

          <div style={card}>
            <p style={sectionTitle}>D.A.R.</p>
            <table style={table}>
              <thead><tr><th style={th}>Situação</th><th style={thR}>Alíquota (%)</th></tr></thead>
              <tbody>
                {[['Pré','dar_pre'],['Pós','dar_pos']].map(([l,k],i)=>(
                  <Row key={k} label={l} chave={k} i={i} p={params} setP={setP} />
                ))}
              </tbody>
            </table>
            <BtnSalvar grupo="dar" />
          </div>

          <div style={card}>
            <p style={sectionTitle}>Abono Natalino</p>
            <table style={table}>
              <thead><tr><th style={th}>Situação</th><th style={thR}>Alíquota (%)</th></tr></thead>
              <tbody>
                {[['Sim','abono_natalino_sim'],['Não','abono_natalino_nao']].map(([l,k],i)=>(
                  <Row key={k} label={l} chave={k} i={i} p={params} setP={setP} />
                ))}
              </tbody>
            </table>
            <BtnSalvar grupo="abono_natalino" />
          </div>
        </div>
      </div>

      {/* ── VR/VT + Escala ────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
        <div style={card}>
          <p style={sectionTitle}>VR/VT — Fração do Mês por Escala</p>
          <table style={table}>
            <thead><tr><th style={th}>Escala</th><th style={thR}>Dias / mês</th></tr></thead>
            <tbody>
              {escalaLabels.map(([key, label], i) => (
                <Row key={key} label={label} chave={`vrvt_${key}`} i={i} p={params} setP={setP} />
              ))}
            </tbody>
          </table>
          <BtnSalvar grupo="vrvt" />
        </div>

        <div style={card}>
          <p style={sectionTitle}>Escala — Fração do Mês (pagamento)</p>
          <table style={table}>
            <thead><tr><th style={th}>Escala</th><th style={thR}>Fração</th></tr></thead>
            <tbody>
              {escalaLabels.map(([key, label], i) => (
                <Row key={key} label={label} chave={`escala_${key}`} i={i} p={params} setP={setP} />
              ))}
            </tbody>
          </table>
          <BtnSalvar grupo="escala" />
        </div>
      </div>

      {/* ── Adicional Noturno ────────────────────────────────────────────── */}
      <div style={card}>
        <p style={sectionTitle}>Adicional Noturno por Escala</p>
        <table style={table}>
          <thead>
            <tr>
              <th style={th}>Escala</th>
              <th style={thR}>Alíquota (h ou R$)</th>
              <th style={thR}>Base (h / mês)</th>
            </tr>
          </thead>
          <tbody>
            {escalaLabels.map(([key, label], i) => (
              <tr key={key}>
                <td style={i%2===0?td0:td1}>{label}</td>
                <td style={i%2===0?tdR0:tdR1}><NumInput value={params[`adnoturno_${key}_aliq`]??0} onChange={(v)=>setP(`adnoturno_${key}_aliq`,v)} /></td>
                <td style={i%2===0?tdR0:tdR1}><NumInput value={params[`adnoturno_${key}_base`]??0} onChange={(v)=>setP(`adnoturno_${key}_base`,v)} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        <BtnSalvar grupo="adnoturno" />
      </div>

      {/* ── Listas de Cargos ─────────────────────────────────────────────── */}
      <div style={card}>
        <p style={sectionTitle}>Lista de Cargos por Cooperativa</p>
        <p style={{ fontSize: 12, color: '#666', marginBottom: 14 }}>
          Um cargo por linha. A ordem define a sequência no dropdown de propostas.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20 }}>
          {COOPS.map((coop) => (
            <div key={coop}>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6, color: '#333' }}>
                {coop}&nbsp;<span style={{ fontWeight: 400, color: '#888' }}>({(cargos[coop] ?? []).length} cargos)</span>
              </div>
              <textarea
                style={textarea}
                value={(cargos[coop] ?? []).join('\n')}
                onChange={(e) =>
                  setCargos((prev) => ({ ...prev, [coop]: e.target.value.split('\n') }))
                }
                spellCheck={false}
              />
              <BtnSalvar grupo={`cargos_${coop}`} />
            </div>
          ))}
        </div>
      </div>

    </div>
  );
};

export default TaxasImpostos;
