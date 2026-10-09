import { IonButton } from '@ionic/react';
import React, { useCallback, useEffect, useState } from 'react';
import {
  CompetenciaListada, ResumoCompetencia,
  fecharCompetenciaESocial, listarCompetenciasESocial, obterResumoCompetencia, reabrirCompetenciaESocial,
} from '../../../api/esocialApi';
import {
  BadgeStatus, ListaOcorrencias, competenciaAnterior, formatarCompetencia, formatarDataHora, formatarMoeda, useEnvioESocial,
} from './esocialComum';
import { useAcessoESocial } from '../../../auth/acessoESocial';

const estiloCard: React.CSSProperties = { background: '#fff', borderRadius: 12, padding: 18, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', marginBottom: 16 };

const COR_STATUS: Record<string, string> = { aberta: '#2e7d32', fechando: '#e65100', fechada: '#1565c0', reabrindo: '#e65100' };

const Contagem: React.FC<{ titulo: string; aceitos: number; rejeitados: number; aguardando: number; pendentes: number }> = (c) => (
  <div style={{ flex: '1 1 220px', border: '1px solid #eee', borderRadius: 10, padding: 12 }}>
    <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>{c.titulo}</div>
    <div style={{ fontSize: 12, display: 'grid', gridTemplateColumns: '1fr auto', rowGap: 2 }}>
      <span>Aceitos</span><strong style={{ color: '#2e7d32' }}>{c.aceitos}</strong>
      <span>Com erro</span><strong style={{ color: '#b71c1c' }}>{c.rejeitados}</strong>
      <span>Aguardando retorno</span><strong style={{ color: '#e65100' }}>{c.aguardando}</strong>
      <span>Não enviados</span><strong>{c.pendentes}</strong>
    </div>
  </div>
);

/**
 * Fechamento mensal do eSocial (Faturamento). Após conferir que todas as notas
 * da competência foram emitidas, o período é fechado: o sistema bloqueia novas
 * movimentações e envia o S-1299. O eSocial devolve os totais de INSS e IRRF.
 */
const ESocialFechamento: React.FC = () => {
  const { podeFechar, podeReabrir } = useAcessoESocial();
  const [competencia, setCompetencia] = useState(competenciaAnterior());
  const [resumo, setResumo] = useState<ResumoCompetencia | null>(null);
  const [historico, setHistorico] = useState<CompetenciaListada[]>([]);
  const [confirmaFaturamento, setConfirmaFaturamento] = useState(false);
  const [processando, setProcessando] = useState(false);
  const [erro, setErro] = useState('');
  const [mensagem, setMensagem] = useState('');

  const carregar = useCallback(() => {
    Promise.all([obterResumoCompetencia(competencia), listarCompetenciasESocial()])
      .then(([r, h]) => { setResumo(r); setHistorico(h); })
      .catch((e) => setErro(e.message));
  }, [competencia]);
  useEffect(() => { setConfirmaFaturamento(false); setMensagem(''); setErro(''); carregar(); }, [carregar]);
  const { consultarRetornos, progresso } = useEnvioESocial(carregar);

  // Fechamento/reabertura em andamento: acompanha o retorno do eSocial
  useEffect(() => {
    if (resumo && (resumo.status === 'fechando' || resumo.status === 'reabrindo')) consultarRetornos();
  }, [resumo?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  const executar = async (acao: 'fechar' | 'reabrir') => {
    const texto = acao === 'fechar'
      ? `Fechar a competência ${formatarCompetencia(competencia)}? Novas notas e movimentações deste período ficarão bloqueadas e o fechamento (S-1299) será enviado ao eSocial.`
      : `Reabrir a competência ${formatarCompetencia(competencia)} no eSocial (S-1298)? Use apenas para corrigir informações já enviadas.`;
    if (!window.confirm(texto)) return;
    setProcessando(true); setErro(''); setMensagem('');
    try {
      const r = acao === 'fechar' ? await fecharCompetenciaESocial(competencia) : await reabrirCompetenciaESocial(competencia);
      setMensagem(r.recebido
        ? `${acao === 'fechar' ? 'Fechamento' : 'Reabertura'} recebido pelo eSocial (protocolo ${r.protocolo}). Aguardando processamento…`
        : `O eSocial não recebeu o envio: ${r.mensagem}`);
      carregar();
      if (r.recebido) consultarRetornos();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao processar.');
    } finally {
      setProcessando(false);
    }
  };

  const evento = resumo?.status === 'reabrindo' ? resumo.s1298 : resumo?.s1299;

  return (
    <div className="painel-page" style={{ padding: 24 }}>
      <div className="painel-header" style={{ marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0 }}>Fechamento eSocial</h2>
          <p className="painel-subtitle" style={{ margin: '4px 0 0' }}>Fechamento mensal dos eventos periódicos e conferência de INSS e IRRF</p>
        </div>
      </div>

      <div style={estiloCard}>
        <div style={{ display: 'flex', gap: 20, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div className="form-field" style={{ margin: 0 }}>
            <label style={{ fontSize: 12, fontWeight: 600 }}>Competência</label>
            <input type="month" className="form-input" value={competencia} onChange={(e) => e.target.value && setCompetencia(e.target.value)} />
          </div>
          {resumo && (
            <div style={{ fontSize: 13 }}>
              Situação: <strong style={{ color: COR_STATUS[resumo.status] }}>{resumo.status.toUpperCase()}</strong>
              {resumo.ambiente === 2 && <span style={{ marginLeft: 8, color: '#e65100' }}>(produção restrita — testes)</span>}
              {resumo.fechadaEm && <div style={{ color: '#555' }}>Fechada em {formatarDataHora(resumo.fechadaEm)} por {resumo.fechamentoSolicitadoPor ?? '—'}</div>}
            </div>
          )}
        </div>
      </div>

      {erro && <div className="form-erro" style={{ marginBottom: 12 }}>{erro}</div>}
      {mensagem && <div style={{ ...estiloCard, background: '#f5faff', color: '#0d47a1', fontSize: 13 }}>{mensagem}</div>}

      {resumo && (
        <>
          <div style={estiloCard}>
            <h4 style={{ marginTop: 0 }}>Envios da competência</h4>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <Contagem titulo={`Remunerações S-1200 (${resumo.totais.cooperados} cooperados)`} {...resumo.s1200} />
              <Contagem titulo={`Pagamentos S-1210 pagos no mês (${resumo.s1210.total})`} {...resumo.s1210} />
            </div>
            {progresso.aguardandoRetorno > 0 && <div style={{ fontSize: 12, color: '#e65100', marginTop: 8 }}>Consultando retornos do eSocial…</div>}
          </div>

          <div style={estiloCard}>
            <h4 style={{ marginTop: 0 }}>Valores da folha</h4>
            <table style={{ borderCollapse: 'collapse', fontSize: 13, minWidth: 420 }}>
              <thead>
                <tr style={{ textAlign: 'left', background: '#f5f5f5' }}>
                  <th style={{ padding: '6px 10px' }}></th>
                  <th style={{ padding: '6px 10px' }}>Enviado pelo sistema</th>
                  <th style={{ padding: '6px 10px' }}>Apurado pelo eSocial</th>
                </tr>
              </thead>
              <tbody>
                <tr><td style={{ padding: '6px 10px' }}>Remuneração bruta</td><td style={{ padding: '6px 10px' }}>{formatarMoeda(resumo.totais.bruto)}</td><td style={{ padding: '6px 10px' }}>—</td></tr>
                <tr><td style={{ padding: '6px 10px' }}>INSS</td><td style={{ padding: '6px 10px' }}>{formatarMoeda(resumo.totais.inss)}</td><td style={{ padding: '6px 10px' }}>{formatarMoeda(resumo.inssApuradoESocial)}</td></tr>
                <tr><td style={{ padding: '6px 10px' }}>IRRF</td><td style={{ padding: '6px 10px' }}>{formatarMoeda(resumo.totais.irrf)}</td><td style={{ padding: '6px 10px' }}>{formatarMoeda(resumo.irrfApuradoESocial)}</td></tr>
              </tbody>
            </table>
            <p className="form-hint" style={{ marginTop: 8 }}>
              Os valores apurados (totalizadores S-5011 e S-5012) chegam quando o eSocial aceita o fechamento. O INSS apurado
              inclui a contribuição da cooperativa, por isso pode ser diferente do valor descontado dos cooperados.
            </p>
          </div>

          <div style={estiloCard}>
            <h4 style={{ marginTop: 0 }}>Fechamento do período (S-1299)</h4>
            {evento && (
              <div style={{ marginBottom: 12, fontSize: 13 }}>
                Último envio: <BadgeStatus status={evento.status} /> <span style={{ color: '#888' }}>{formatarDataHora(evento.criadoEm)}</span>
                {evento.status === 'aceito'
                  ? <div style={{ color: '#2e7d32', marginTop: 4 }}>Recibo {evento.nrRecibo}</div>
                  : <ListaOcorrencias ocorrencias={evento.ocorrencias} descricao={evento.descResposta} />}
              </div>
            )}

            {resumo.status === 'aberta' && (
              <>
                {resumo.pendencias.length > 0 ? (
                  <div style={{ fontSize: 13, color: '#b71c1c', marginBottom: 12 }}>
                    <strong>Pendências antes do fechamento:</strong>
                    <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>{resumo.pendencias.map((p) => <li key={p}>{p}</li>)}</ul>
                    <div style={{ color: '#555', marginTop: 4 }}>Os envios são feitos pelo Departamento de Benefícios (Benefícios › eSocial).</div>
                  </div>
                ) : (
                  <div style={{ fontSize: 13, color: '#2e7d32', marginBottom: 12 }}>Todos os envios da competência foram aceitos pelo eSocial.</div>
                )}
                <label className="form-checkbox-row" style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, marginBottom: 12 }}>
                  <input type="checkbox" checked={confirmaFaturamento} onChange={(e) => setConfirmaFaturamento(e.target.checked)} />
                  Confirmo que todos os faturamentos de {formatarCompetencia(competencia)} foram emitidos.
                </label>
                <IonButton style={podeFechar ? undefined : { display: 'none' }} size="small" shape="round" color="success" disabled={!resumo.podeFechar || !confirmaFaturamento || processando} onClick={() => executar('fechar')}>
                  {processando ? 'Enviando…' : 'Fechar período e enviar ao eSocial'}
                </IonButton>
              </>
            )}
            {(resumo.status === 'fechando' || resumo.status === 'reabrindo') && (
              <div style={{ fontSize: 13, color: '#e65100' }}>
                {resumo.status === 'fechando' ? 'Fechamento' : 'Reabertura'} enviado; aguardando o processamento do eSocial. Movimentações bloqueadas.
              </div>
            )}
            {resumo.status === 'fechada' && (
              <>
                <div style={{ fontSize: 13, color: '#1565c0', marginBottom: 12 }}>
                  Período fechado: novas notas, movimentações e envios de remuneração desta competência estão bloqueados.
                </div>
                <IonButton style={podeReabrir ? undefined : { display: 'none' }} size="small" shape="round" fill="outline" color="success" disabled={processando} onClick={() => executar('reabrir')}>Reabrir período (S-1298)</IonButton>
              </>
            )}
          </div>
        </>
      )}

      {historico.length > 0 && (
        <div style={estiloCard}>
          <h4 style={{ marginTop: 0 }}>Competências</h4>
          <table style={{ borderCollapse: 'collapse', fontSize: 13, width: '100%' }}>
            <thead>
              <tr style={{ textAlign: 'left', background: '#f5f5f5' }}>
                {['Competência', 'Situação', 'Fechada em', 'INSS apurado', 'IRRF apurado'].map((h) => <th key={h} style={{ padding: '6px 10px' }}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {historico.map((h) => (
                <tr key={h.competencia} onClick={() => setCompetencia(h.competencia)} style={{ cursor: 'pointer', borderBottom: '1px solid #f0f0f0' }}>
                  <td style={{ padding: '6px 10px' }}>{formatarCompetencia(h.competencia)}</td>
                  <td style={{ padding: '6px 10px', color: COR_STATUS[h.status], fontWeight: 600 }}>{h.status}</td>
                  <td style={{ padding: '6px 10px' }}>{formatarDataHora(h.fechada_em)}</td>
                  <td style={{ padding: '6px 10px' }}>{formatarMoeda(h.inss_apurado)}</td>
                  <td style={{ padding: '6px 10px' }}>{formatarMoeda(h.irrf_apurado)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default ESocialFechamento;
