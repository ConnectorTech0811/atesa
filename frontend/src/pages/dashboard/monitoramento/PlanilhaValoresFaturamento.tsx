import React, { useEffect, useMemo, useState } from 'react';
import { useToast } from '../../../components/ToastContext';
import { formatarDataBR, formatarMoeda } from '../../../utils/formatters';
import {
  PlanilhaFaturamento,
  ReferenciasValoresFaturamento,
  obterReferenciasValoresFaturamento,
} from '../../../api/escalaFaturamentoApi';
import {
  COLUNAS_VALORES,
  baixarPlanilhaValores,
  calcularPlanilhaValores,
  parametrosDasReferencias,
  totaisValores,
} from '../../../utils/planilhaValoresFaturamento';

interface Props {
  empresaId: number | '';
  /** Planilha de produtividade gerada no card 2 (fonte das quantidades). */
  planilha: PlanilhaFaturamento | null;
}

const numOuNull = (s: string) => {
  if (s.trim() === '') return null;
  const n = Number(s.replace(',', '.'));
  return Number.isFinite(n) && n >= 0 && n <= 100 ? n : null;
};

const fmtPct = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 2 });

export const PlanilhaValoresFaturamento: React.FC<Props> = ({ empresaId, planilha }) => {
  const { showToast } = useToast();
  const [ref, setRef] = useState<ReferenciasValoresFaturamento | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [taxaManual, setTaxaManual] = useState('');
  const [issManual, setIssManual] = useState('');
  const [baixando, setBaixando] = useState(false);

  useEffect(() => {
    setRef(null);
    setTaxaManual('');
    setIssManual('');
    if (!empresaId) return;
    setCarregando(true);
    obterReferenciasValoresFaturamento(Number(empresaId))
      .then((r) => {
        setRef(r);
        if (r.aliquotas.iss.percentual !== null) setIssManual(String(r.aliquotas.iss.percentual).replace('.', ','));
      })
      .catch((e) => showToast(e?.message || 'Erro ao carregar os valores do Parâmetro.', 'error'))
      .finally(() => setCarregando(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recarrega só ao trocar de cliente
  }, [empresaId]);

  const unidadesSemTaxa = ref?.unidades.filter((u) => u.taxa_adm_percentual === null) ?? [];
  const unidadesComTaxa = ref?.unidades.filter((u) => u.taxa_adm_percentual !== null) ?? [];

  const params = useMemo(
    () => (ref ? parametrosDasReferencias(ref, { taxaAdmPadrao: numOuNull(taxaManual), issPercentual: numOuNull(issManual) }) : null),
    [ref, taxaManual, issManual]
  );
  const linhas = useMemo(
    () => (ref && params && planilha ? calcularPlanilhaValores(planilha.linhas, ref, params) : []),
    [ref, params, planilha]
  );
  const totais = useMemo(() => totaisValores(linhas), [linhas]);
  const comPendencia = linhas.filter((l) => l.pendencias.length > 0).length;

  const origemIss = ref?.aliquotas.iss.origem === 'nota'
    ? `última NFS-e emitida${ref.aliquotas.iss.data_nota ? ` (${formatarDataBR(String(ref.aliquotas.iss.data_nota).slice(0, 10))})` : ''}`
    : ref?.aliquotas.iss.origem === 'estado'
      ? `Taxas e Impostos — ${ref.aliquotas.iss.uf}`
      : 'sem nota emitida nem alíquota para o estado do cliente — informe';

  const handleBaixar = async () => {
    if (!params || !planilha) return;
    setBaixando(true);
    try {
      await baixarPlanilhaValores({ empresa: planilha.empresa.nome, competencia: planilha.competencia, linhas, p: params });
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao gerar o arquivo .xlsx.', 'error');
    } finally {
      setBaixando(false);
    }
  };

  return (
    <div className="monitoramento-table-card">
      <div className="table-card-header">
        <div>
          <h3 className="table-card-title">3. Planilha de Faturamento — Valores (R$)</h3>
          <p style={{ margin: '4px 0 0 0', fontSize: 13, color: '#64748b' }}>
            Quantidades da planilha de produtividade (card 2) × valores da vaga no Parâmetro, com DAR, taxa administrativa, NF, retenções e valor da fatura.
          </p>
        </div>
        {planilha && params && (
          <button type="button" className="btn-save-ajuste" onClick={handleBaixar} disabled={baixando || linhas.length === 0}>
            {baixando ? 'Gerando...' : '⬇ Baixar .xlsx'}
          </button>
        )}
      </div>

      {!empresaId ? (
        <p style={{ padding: '18px 24px', margin: 0, color: '#94a3b8', fontSize: 13 }}>Selecione o cliente.</p>
      ) : carregando ? (
        <p style={{ padding: '18px 24px', margin: 0, color: '#94a3b8', fontSize: 13 }}>Carregando valores do Parâmetro...</p>
      ) : ref && (
        <div style={{ padding: '12px 24px', borderBottom: '1px solid #f1f5f9', display: 'flex', gap: 24, flexWrap: 'wrap', fontSize: 13, color: '#334155' }}>
          <div>
            <strong>Taxa Adm (taxa de serviço do Parâmetro):</strong>{' '}
            {unidadesComTaxa.length === 0 ? <span style={{ color: '#b45309' }}>não informada</span>
              : unidadesComTaxa.map((u) => `${u.nome_unidade}: ${fmtPct(u.taxa_adm_percentual!)}%`).join(' · ')}
            {(unidadesSemTaxa.length > 0 || ref.unidades.length === 0) && (
              <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ color: '#b45309' }}>
                  {ref.unidades.length === 0 ? 'Cliente sem ficha no Parâmetro' : `Sem taxa: ${unidadesSemTaxa.map((u) => u.nome_unidade).join(', ')}`} →
                </span>
                <input className="filter-input" style={{ width: 80 }} inputMode="decimal" placeholder="%" value={taxaManual} onChange={(e) => setTaxaManual(e.target.value)} />
                <span>%</span>
              </div>
            )}
          </div>
          <div>
            <strong>ISS:</strong>{' '}
            <input className="filter-input" style={{ width: 80 }} inputMode="decimal" placeholder="%" value={issManual} onChange={(e) => setIssManual(e.target.value)} /> %
            <span style={{ marginLeft: 6, color: ref.aliquotas.iss.origem === 'nenhuma' ? '#b45309' : '#64748b' }}>({origemIss}{ref.aliquotas.iss.retido ? '' : ' · não retido'})</span>
          </div>
          <div style={{ color: '#64748b' }}>
            DAR {fmtPct(ref.aliquotas.dar)}% · IR {fmtPct(ref.aliquotas.irrf)}% · PIS {fmtPct(ref.aliquotas.pis)}% · COFINS {fmtPct(ref.aliquotas.cofins)}%
          </div>
        </div>
      )}

      {empresaId && ref && !planilha && (
        <p style={{ padding: '18px 24px', margin: 0, color: '#94a3b8', fontSize: 13 }}>Gere a planilha no card 2 para calcular os valores.</p>
      )}

      {planilha && params && (
        <>
          {comPendencia > 0 && (
            <div style={{ padding: '10px 24px', background: '#fffbeb', color: '#92400e', fontSize: 13, borderBottom: '1px solid #fde68a' }}>
              ⚠ {comPendencia} linha(s) com pendência (valor zerado ou incompleto). Passe o mouse sobre a linha para ver o motivo.
            </div>
          )}
          <div className="table-responsive">
            <table className="monitoramento-table" style={{ fontSize: 12 }}>
              <thead>
                <tr>
                  <th>Cooperado</th>
                  <th>Função</th>
                  {COLUNAS_VALORES.map((c) => <th key={c.chave} style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>{c.titulo}</th>)}
                </tr>
              </thead>
              <tbody>
                {linhas.length === 0 ? (
                  <tr><td colSpan={COLUNAS_VALORES.length + 2} style={{ textAlign: 'center', padding: 28, color: '#94a3b8' }}>Nenhum cooperado na planilha.</td></tr>
                ) : linhas.map((v, i) => (
                  <tr key={`${v.linha.alocacao_id ?? 'v'}-${v.linha.candidato_id}-${i}`}
                    style={v.pendencias.length ? { background: '#fffbeb' } : undefined}
                    title={v.pendencias.join('\n') || undefined}>
                    <td style={{ whiteSpace: 'nowrap' }}><strong>{v.linha.cooperado}</strong><br /><span style={{ color: '#64748b' }}>Mat. {v.linha.matricula}</span></td>
                    <td style={{ whiteSpace: 'nowrap' }}>{v.linha.atividade}{v.unidade && <><br /><span style={{ color: '#64748b' }}>por {v.unidade}</span></>}</td>
                    {COLUNAS_VALORES.map((c) => (
                      <td key={c.chave} style={{ whiteSpace: 'nowrap', textAlign: 'right', fontWeight: c.chave === 'fatura' ? 700 : undefined }}>
                        {c.moeda ? (v[c.chave] ? formatarMoeda(v[c.chave]) : '—') : v[c.chave].toLocaleString('pt-BR', { maximumFractionDigits: 2 })}
                      </td>
                    ))}
                  </tr>
                ))}
                {linhas.length > 0 && (
                  <tr style={{ background: '#f8fafc', fontWeight: 700 }}>
                    <td colSpan={2}>Total ({linhas.length})</td>
                    {COLUNAS_VALORES.map((c) => (
                      <td key={c.chave} style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>{c.moeda ? formatarMoeda(totais[c.chave]) : ''}</td>
                    ))}
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <p style={{ padding: '10px 24px', margin: 0, fontSize: 12, color: '#64748b' }}>
            Plantão: remuneração por plantão; procedimento: por dia; mensal: proporcional aos dias no mês, menos as horas de falta (÷ 220 h).
            Insalubridade sobre o salário mínimo (R$ {ref ? formatarMoeda(ref.salario_minimo).replace('R$', '').trim() : ''}; Pré/Médio 20%, Alto 40%), ÷ 15 por plantão.
            Ad. noturno = valor da hora × 20% × horas noturnas apuradas; hora excedente = valor da hora × 1,5.
            DAR sobre os serviços prestados; Taxa Adm sobre total do cooperado + DAR; IR sobre os serviços; PIS, COFINS e ISS sobre a NF.
          </p>
        </>
      )}
    </div>
  );
};

export default PlanilhaValoresFaturamento;
