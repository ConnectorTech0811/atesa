import { IonButton } from '@ionic/react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CadastroESocial, ConfigESocial, LinhaImportacao, LoteESocial, RemuneracaoESocial, ResumoCompetencia, SituacaoCertificado,
  importarRemuneracoesESocial, listarCadastrosESocial, listarLotesESocial, listarRemuneracoesESocial,
  marcarCadastrosExistentes, obterConfigESocial, obterResumoCompetencia, removerRemuneracaoESocial, salvarConfigESocial,
} from '../../../api/esocialApi';
import {
  BadgeStatus, FiltroSituacao, GrupoSituacao, ListaOcorrencias, ModalHistorico, PainelProgresso,
  baixarArquivo, competenciaAnterior, contarGrupos, formatarCompetencia, formatarDataHora, formatarDataIso,
  formatarMoeda, grupoDaSituacao, lerCsv, normalizarCabecalho, useEnvioESocial,
} from './esocialComum';
import { useAcessoESocial } from '../../../auth/acessoESocial';

type SubAba = 'cadastro' | 'folha' | 'lotes' | 'config';

const estiloCard: React.CSSProperties = { background: '#fff', borderRadius: 12, padding: 18, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', marginBottom: 16 };
const estiloTh: React.CSSProperties = { padding: '8px 10px', borderBottom: '1px solid #e0e0e0', textAlign: 'left', fontSize: 12, whiteSpace: 'nowrap' };
const estiloTd: React.CSSProperties = { padding: '8px 10px', borderBottom: '1px solid #f0f0f0', fontSize: 12, verticalAlign: 'top' };

/** Integração eSocial do módulo de Benefícios: cadastro (S-2300) e folha mensal (S-1200/S-1210). */
const ESocialBeneficios: React.FC = () => {
  const acesso = useAcessoESocial();
  const [subAba, setSubAba] = useState<SubAba>('cadastro');
  const [config, setConfig] = useState<ConfigESocial | null>(null);
  const [certificado, setCertificado] = useState<SituacaoCertificado | null>(null);
  const [erro, setErro] = useState('');

  const carregarConfig = useCallback(() => {
    obterConfigESocial()
      .then((r) => { setConfig(r.config); setCertificado(r.certificado); })
      .catch((e) => setErro(e.message));
  }, []);
  useEffect(() => { carregarConfig(); }, [carregarConfig]);

  return (
    <div>
      {erro && <div className="form-erro" style={{ marginBottom: 12 }}>{erro}</div>}
      <CabecalhoAmbiente config={config} certificado={certificado} onConfigurar={() => setSubAba('config')} />

      <div className="exec-abas" style={{ marginBottom: 16 }}>
        {([
          ['cadastro', 'Cadastro do cooperado (S-2300)'],
          ['folha', 'Folha mensal (S-1200 / S-1210)'],
          ['lotes', 'Lotes enviados'],
          ['config', 'Configuração'],
        ] as [SubAba, string][]).filter(([id]) => id !== 'config' || acesso.podeConfigurar).map(([id, texto]) => (
          <button key={id} className={`exec-aba${subAba === id ? ' exec-aba-ativa' : ''}`} onClick={() => setSubAba(id)}>{texto}</button>
        ))}
      </div>

      {subAba === 'cadastro' && <SecaoCadastro />}
      {subAba === 'folha' && <SecaoFolha />}
      {subAba === 'lotes' && <SecaoLotes />}
      {subAba === 'config' && config && acesso.podeConfigurar && <SecaoConfig config={config} certificado={certificado} onSalvo={carregarConfig} />}
    </div>
  );
};

const CabecalhoAmbiente: React.FC<{ config: ConfigESocial | null; certificado: SituacaoCertificado | null; onConfigurar: () => void }> = ({ config, certificado, onConfigurar }) => {
  const { podeConfigurar } = useAcessoESocial();
  if (!config) return null;
  const producao = Number(config.ambiente) === 1;
  return (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14, fontSize: 12 }}>
      <span style={{ padding: '4px 10px', borderRadius: 12, fontWeight: 700, background: producao ? '#e8f5e9' : '#fff8e1', color: producao ? '#2e7d32' : '#e65100' }}>
        Ambiente: {producao ? 'PRODUÇÃO' : 'Produção restrita (testes)'}
      </span>
      {certificado?.valido
        ? <span style={{ color: '#2e7d32' }}>Certificado: {certificado.titular} · válido até {formatarDataIso(certificado.validoAte)}</span>
        : <span style={{ color: '#b71c1c', fontWeight: 600 }}>⚠ {certificado?.erro ?? 'Certificado digital não configurado.'}</span>}
      {!config.nr_insc_empregador && podeConfigurar && (
        <IonButton size="small" shape="round" fill="outline" color="success" onClick={onConfigurar}>Completar configuração</IonButton>
      )}
    </div>
  );
};

// ── Cadastro (S-2300) ────────────────────────────────────────────────────────

const SecaoCadastro: React.FC = () => {
  const { podeEnviar, podeImportar } = useAcessoESocial();
  const [linhas, setLinhas] = useState<CadastroESocial[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [filtro, setFiltro] = useState<GrupoSituacao>('todos');
  const [busca, setBusca] = useState('');
  const [selecionados, setSelecionados] = useState<Set<number>>(new Set());
  const [historico, setHistorico] = useState<CadastroESocial | null>(null);

  const carregar = useCallback(() => {
    listarCadastrosESocial().then(setLinhas).catch((e) => setErro(e.message)).finally(() => setCarregando(false));
  }, []);
  useEffect(() => { carregar(); }, [carregar]);
  const { progresso, enviar, consultarRetornos, limpar } = useEnvioESocial(carregar);

  // Retoma a consulta de retornos pendentes ao abrir a tela
  useEffect(() => {
    if (linhas.some((l) => grupoDaSituacao(l.status) === 'aguardando')) consultarRetornos();
  }, [linhas.length > 0]); // eslint-disable-line react-hooks/exhaustive-deps

  const contagem = useMemo(() => contarGrupos(linhas, (l) => l.status), [linhas]);
  const visiveis = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return linhas.filter((l) => (filtro === 'todos' || grupoDaSituacao(l.status) === filtro)
      && (!t || l.nome.toLowerCase().includes(t) || (l.matricula ?? '').toLowerCase().includes(t) || (l.cpf ?? '').includes(t)));
  }, [linhas, filtro, busca]);

  const alternar = (id: number) => setSelecionados((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const comErroVisiveis = visiveis.filter((l) => grupoDaSituacao(l.status) === 'erros');

  const marcarExistentes = async () => {
    const ids = [...selecionados].filter((id) => grupoDaSituacao(linhas.find((l) => l.candidato_id === id)?.status) !== 'aceitos');
    if (!ids.length) return;
    if (!window.confirm(`Registrar ${ids.length} cooperado(s) como já cadastrados no eSocial por outro sistema? Use apenas para quem já tem o S-2300 aceito no eSocial.`)) return;
    try {
      await marcarCadastrosExistentes(ids);
      setSelecionados(new Set());
      carregar();
    } catch (e) { setErro(e instanceof Error ? e.message : 'Erro ao registrar.'); }
  };

  return (
    <div>
      <div style={estiloCard}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div style={{ maxWidth: 640, fontSize: 13, color: '#555' }}>
            Após a alocação, o cooperado (interno ou externo) precisa ser cadastrado no eSocial (evento S-2300) com
            matrícula, dados pessoais, endereço e cargo/CBO. O envio é feito em lotes de até 50 cooperados.
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <IonButton style={podeEnviar ? undefined : { display: 'none' }} size="small" shape="round" color="success" disabled={progresso.emAndamento || contagem.nao_enviados === 0} onClick={() => enviar({ tipo: 'S-2300' })}>
              Enviar {contagem.nao_enviados} não enviado(s)
            </IonButton>
            <IonButton style={podeEnviar ? undefined : { display: 'none' }} size="small" shape="round" fill="outline" color="success" disabled={progresso.emAndamento || comErroVisiveis.length === 0}
              onClick={() => enviar({ tipo: 'S-2300', candidatoIds: comErroVisiveis.map((l) => l.candidato_id) })}>
              Reenviar {comErroVisiveis.length} com erro
            </IonButton>
          </div>
        </div>
      </div>

      <PainelProgresso progresso={progresso} onFechar={limpar} />
      {erro && <div className="form-erro" style={{ marginBottom: 12 }}>{erro}</div>}

      <div style={estiloCard}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
          <FiltroSituacao valor={filtro} onChange={setFiltro} contagem={contagem} />
          <input className="form-input" style={{ maxWidth: 260 }} placeholder="Buscar nome, matrícula ou CPF" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
        {selecionados.size > 0 && podeEnviar && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10, fontSize: 12 }}>
            <strong>{selecionados.size} selecionado(s)</strong>
            <IonButton style={podeEnviar ? undefined : { display: 'none' }} size="small" shape="round" fill="outline" color="success" disabled={progresso.emAndamento}
              onClick={() => enviar({ tipo: 'S-2300', candidatoIds: [...selecionados] })}>Enviar selecionados</IonButton>
            <IonButton style={podeEnviar ? undefined : { display: 'none' }} size="small" shape="round" fill="outline" color="success" onClick={marcarExistentes}>Já cadastrados no eSocial</IonButton>
            <IonButton size="small" shape="round" fill="outline" color="medium" onClick={() => setSelecionados(new Set())}>Limpar seleção</IonButton>
          </div>
        )}
        {carregando ? <div style={{ color: '#888' }}>Carregando…</div> : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f5f5f5' }}>
                  <th style={estiloTh}>
                    <input type="checkbox" checked={visiveis.length > 0 && visiveis.every((l) => selecionados.has(l.candidato_id))}
                      onChange={(e) => setSelecionados(e.target.checked ? new Set(visiveis.map((l) => l.candidato_id)) : new Set())} />
                  </th>
                  <th style={estiloTh}>Cooperado</th>
                  <th style={estiloTh}>Matrícula</th>
                  <th style={estiloTh}>Tipo</th>
                  <th style={estiloTh}>Situação</th>
                  <th style={estiloTh}>Resultado</th>
                  <th style={estiloTh}>Tentativas</th>
                  <th style={estiloTh}></th>
                </tr>
              </thead>
              <tbody>
                {visiveis.map((l) => (
                  <tr key={l.candidato_id}>
                    <td style={estiloTd}><input type="checkbox" checked={selecionados.has(l.candidato_id)} onChange={() => alternar(l.candidato_id)} /></td>
                    <td style={estiloTd}><strong>{l.nome}</strong><div style={{ color: '#888' }}>{l.cpf}</div></td>
                    <td style={estiloTd}>{l.matricula ?? '—'}</td>
                    <td style={estiloTd}>{l.tipo_contratacao ?? '—'}</td>
                    <td style={estiloTd}>
                      <BadgeStatus status={l.status} />
                      {l.ultima_tentativa_em && <div style={{ color: '#888', marginTop: 2 }}>{formatarDataHora(l.ultima_tentativa_em)}</div>}
                    </td>
                    <td style={{ ...estiloTd, maxWidth: 380 }}>
                      {l.status === 'aceito'
                        ? <span style={{ color: '#2e7d32' }}>{l.origem === 'externo' ? 'Cadastrado por outro sistema' : `Recibo ${l.nr_recibo ?? '—'}`}</span>
                        : <ListaOcorrencias ocorrencias={l.ocorrencias} descricao={l.desc_resposta} />}
                    </td>
                    <td style={estiloTd}>{l.tentativas}</td>
                    <td style={{ ...estiloTd, whiteSpace: 'nowrap' }}>
                      {grupoDaSituacao(l.status) === 'erros' && (
                        <IonButton style={podeEnviar ? undefined : { display: 'none' }} size="small" shape="round" fill="outline" color="medium" disabled={progresso.emAndamento}
                          onClick={() => enviar({ tipo: 'S-2300', candidatoIds: [l.candidato_id] })}>Reenviar</IonButton>
                      )}{' '}
                      <IonButton size="small" shape="round" fill="outline" color="medium" onClick={() => setHistorico(l)}>Histórico</IonButton>
                    </td>
                  </tr>
                ))}
                {!visiveis.length && <tr><td colSpan={8} style={{ ...estiloTd, textAlign: 'center', color: '#888', padding: 24 }}>Nenhum cooperado neste filtro.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {historico && <ModalHistorico candidatoId={historico.candidato_id} nome={historico.nome} tipo="S-2300" onFechar={() => setHistorico(null)} />}
    </div>
  );
};

// ── Folha mensal (S-1200 / S-1210) ───────────────────────────────────────────

const COLUNAS_MODELO = ['matricula', 'cpf', 'valor_bruto', 'valor_inss', 'valor_irrf', 'valor_liquido', 'data_pagamento', 'cnpj_estab', 'cod_lotacao'];

const SecaoFolha: React.FC = () => {
  const { podeEnviar, podeImportar } = useAcessoESocial();
  const [competencia, setCompetencia] = useState(competenciaAnterior());
  const [linhas, setLinhas] = useState<RemuneracaoESocial[]>([]);
  const [resumo, setResumo] = useState<ResumoCompetencia | null>(null);
  const [erro, setErro] = useState('');
  const [errosImportacao, setErrosImportacao] = useState<{ linha: number; mensagem: string }[]>([]);
  const [mensagem, setMensagem] = useState('');
  const [evento, setEvento] = useState<'S-1200' | 'S-1210'>('S-1200');
  const [filtro, setFiltro] = useState<GrupoSituacao>('todos');
  const [busca, setBusca] = useState('');
  const [historico, setHistorico] = useState<RemuneracaoESocial | null>(null);
  const arquivoRef = useRef<HTMLInputElement>(null);

  const carregar = useCallback(() => {
    setErro('');
    Promise.all([listarRemuneracoesESocial(competencia), obterResumoCompetencia(competencia)])
      .then(([l, r]) => { setLinhas(l); setResumo(r); })
      .catch((e) => setErro(e.message));
  }, [competencia]);
  useEffect(() => { carregar(); }, [carregar]);
  const { progresso, enviar, consultarRetornos, limpar } = useEnvioESocial(carregar);

  useEffect(() => {
    if (linhas.some((l) => grupoDaSituacao(l.s1200_status) === 'aguardando' || grupoDaSituacao(l.s1210_status) === 'aguardando')) consultarRetornos();
  }, [competencia, linhas.length > 0]); // eslint-disable-line react-hooks/exhaustive-deps

  const status = (l: RemuneracaoESocial) => (evento === 'S-1200' ? l.s1200_status : l.s1210_status);
  const contagem = useMemo(() => contarGrupos(linhas, status), [linhas, evento]); // eslint-disable-line react-hooks/exhaustive-deps
  const visiveis = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return linhas.filter((l) => (filtro === 'todos' || grupoDaSituacao(status(l)) === filtro)
      && (!t || l.nome.toLowerCase().includes(t) || (l.matricula ?? '').toLowerCase().includes(t)));
  }, [linhas, filtro, busca, evento]); // eslint-disable-line react-hooks/exhaustive-deps

  const aberta = resumo?.status === 'aberta';
  // Envio em massa só considera quem cumpre o pré-requisito (S-2300 aceito para S-1200; S-1200 aceito para S-1210)
  const prontosParaEnviar = linhas.filter((l) => !status(l) && (evento === 'S-1200' ? l.s2300_status === 'aceito' : l.s1200_status === 'aceito')).length;
  const aguardandoPreRequisito = linhas.filter((l) => !status(l)).length - prontosParaEnviar;
  const comErro = linhas.filter((l) => grupoDaSituacao(status(l)) === 'erros');

  const importar = async (arquivo: File) => {
    setErrosImportacao([]); setMensagem(''); setErro('');
    try {
      const tabela = lerCsv(await arquivo.text());
      if (tabela.length < 2) throw new Error('Planilha vazia ou sem cabeçalho.');
      const cab = tabela[0].map(normalizarCabecalho);
      if (!cab.includes('valor_bruto') || (!cab.includes('matricula') && !cab.includes('cpf'))) {
        throw new Error('Cabeçalho inválido: são obrigatórias as colunas matricula (ou cpf), valor_bruto e data_pagamento. Baixe o modelo.');
      }
      const dados: LinhaImportacao[] = tabela.slice(1).map((cols, i) => {
        const o: Record<string, string | number> = { __linha: i + 2 };
        cab.forEach((c, j) => { if (COLUNAS_MODELO.includes(c)) o[c] = (cols[j] ?? '').trim(); });
        return o as unknown as LinhaImportacao;
      });
      const r = await importarRemuneracoesESocial(competencia, dados);
      if (r.erros.length) setErrosImportacao(r.erros);
      else setMensagem(`${r.importadas} remuneração(ões) importada(s) para ${formatarCompetencia(competencia)}.`);
      carregar();
    } catch (e) { setErro(e instanceof Error ? e.message : 'Erro ao importar planilha.'); }
  };

  const remover = async (l: RemuneracaoESocial) => {
    if (!window.confirm(`Remover a remuneração de ${l.nome} em ${formatarCompetencia(competencia)}?`)) return;
    try { await removerRemuneracaoESocial(competencia, l.candidato_id); carregar(); }
    catch (e) { setErro(e instanceof Error ? e.message : 'Erro ao remover.'); }
  };

  const alteradoAposEnvio = (l: RemuneracaoESocial) => l.s1200_status === 'aceito' && l.s1200_em && new Date(l.atualizado_em) > new Date(l.s1200_em);

  return (
    <div>
      <div style={estiloCard}>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div className="form-field" style={{ margin: 0 }}>
              <label style={{ fontSize: 12, fontWeight: 600 }}>Competência</label>
              <input type="month" className="form-input" value={competencia} onChange={(e) => e.target.value && setCompetencia(e.target.value)} />
            </div>
            {resumo && (
              <div style={{ fontSize: 13 }}>
                <div>Situação do período: <strong style={{ color: aberta ? '#2e7d32' : '#b71c1c' }}>{resumo.status.toUpperCase()}</strong></div>
                <div style={{ color: '#555' }}>
                  {resumo.totais.cooperados} cooperado(s) · Bruto {formatarMoeda(resumo.totais.bruto)} · INSS {formatarMoeda(resumo.totais.inss)} · IRRF {formatarMoeda(resumo.totais.irrf)}
                </div>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <IonButton size="small" shape="round" fill="outline" color="success"
              onClick={() => baixarArquivo('modelo_remuneracoes_esocial.csv', `${COLUNAS_MODELO.join(';')}\nRA20260001;;5000,00;550,00;300,50;;05/${competencia.slice(5)}/${competencia.slice(0, 4)};;\n`)}>
              Baixar modelo
            </IonButton>
            <IonButton style={podeImportar ? undefined : { display: 'none' }} size="small" shape="round" color="success" disabled={!aberta} onClick={() => arquivoRef.current?.click()}>
              Importar planilha (CSV)
            </IonButton>
            <input ref={arquivoRef} type="file" accept=".csv,text/csv" hidden
              onChange={(e) => { const f = e.target.files?.[0]; if (f) importar(f); e.target.value = ''; }} />
          </div>
        </div>
        {!aberta && resumo && (
          <div style={{ marginTop: 10, fontSize: 12, color: '#b71c1c' }}>
            Período {resumo.status}: importações e envios de remuneração estão bloqueados. A reabertura é feita pelo Faturamento.
          </div>
        )}
        {mensagem && <div style={{ marginTop: 10, fontSize: 13, color: '#2e7d32' }}>{mensagem}</div>}
        {errosImportacao.length > 0 && (
          <div style={{ marginTop: 10, fontSize: 12, color: '#b71c1c' }}>
            <strong>Nenhuma linha foi importada. Corrija a planilha:</strong>
            <ul style={{ margin: '4px 0 0', paddingLeft: 18, maxHeight: 180, overflow: 'auto' }}>
              {errosImportacao.map((e) => <li key={e.linha}>Linha {e.linha}: {e.mensagem}</li>)}
            </ul>
          </div>
        )}
      </div>

      {erro && <div className="form-erro" style={{ marginBottom: 12 }}>{erro}</div>}
      <PainelProgresso progresso={progresso} onFechar={limpar} />

      <div style={estiloCard}>
        <div className="exec-abas" style={{ marginBottom: 12 }}>
          {(['S-1200', 'S-1210'] as const).map((ev) => (
            <button key={ev} className={`exec-aba${evento === ev ? ' exec-aba-ativa' : ''}`} onClick={() => { setEvento(ev); setFiltro('todos'); }}>
              {ev === 'S-1200' ? '1. Remuneração (S-1200)' : '2. Pagamento (S-1210)'}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
          <FiltroSituacao valor={filtro} onChange={setFiltro} contagem={contagem} />
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input className="form-input" style={{ maxWidth: 220 }} placeholder="Buscar nome ou matrícula" value={busca} onChange={(e) => setBusca(e.target.value)} />
            <IonButton style={podeEnviar ? undefined : { display: 'none' }} size="small" shape="round" color="success" disabled={progresso.emAndamento || prontosParaEnviar === 0 || (evento === 'S-1200' && !aberta)}
              onClick={() => enviar({ tipo: evento, competencia })}>
              Enviar {prontosParaEnviar} pendente(s)
            </IonButton>
            <IonButton style={podeEnviar ? undefined : { display: 'none' }} size="small" shape="round" fill="outline" color="success" disabled={progresso.emAndamento || comErro.length === 0}
              onClick={() => enviar({ tipo: evento, competencia, candidatoIds: comErro.map((l) => l.candidato_id) })}>
              Reenviar {comErro.length} com erro
            </IonButton>
          </div>
        </div>
        {aguardandoPreRequisito > 0 && (
          <div style={{ fontSize: 12, color: '#e65100', marginBottom: 10 }}>
            {aguardandoPreRequisito} cooperado(s) aguardando {evento === 'S-1200' ? 'o cadastro (S-2300) ser aceito' : 'a remuneração (S-1200) ser aceita'} antes do envio.
          </div>
        )}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f5f5f5' }}>
                <th style={estiloTh}>Cooperado</th>
                <th style={estiloTh}>Bruto</th>
                <th style={estiloTh}>INSS</th>
                <th style={estiloTh}>IRRF</th>
                <th style={estiloTh}>Pagamento</th>
                <th style={estiloTh}>Situação</th>
                <th style={estiloTh}>Resultado</th>
                <th style={estiloTh}>Tent.</th>
                <th style={estiloTh}></th>
              </tr>
            </thead>
            <tbody>
              {visiveis.map((l) => {
                const st = status(l);
                const ocorr = evento === 'S-1200' ? l.s1200_ocorrencias : l.s1210_ocorrencias;
                const desc = evento === 'S-1200' ? l.s1200_desc : l.s1210_desc;
                const recibo = evento === 'S-1200' ? l.s1200_recibo : l.s1210_recibo;
                return (
                  <tr key={l.id}>
                    <td style={estiloTd}>
                      <strong>{l.nome}</strong>
                      <div style={{ color: '#888' }}>{l.matricula} · {l.tipo_contratacao ?? '—'}</div>
                      {evento === 'S-1200' && l.s2300_status !== 'aceito' && <div style={{ color: '#e65100' }}>Cadastro S-2300 não aceito</div>}
                    </td>
                    <td style={estiloTd}>{formatarMoeda(l.valor_bruto)}</td>
                    <td style={estiloTd}>{formatarMoeda(l.valor_inss)}</td>
                    <td style={estiloTd}>{formatarMoeda(l.valor_irrf)}</td>
                    <td style={estiloTd}>
                      {formatarDataIso(l.data_pagamento)}
                      {l.data_pagamento && l.data_pagamento.slice(0, 7) !== competencia && (
                        <div style={{ color: '#888' }}>S-1210 em {formatarCompetencia(l.data_pagamento.slice(0, 7))}</div>
                      )}
                    </td>
                    <td style={estiloTd}>
                      <BadgeStatus status={st} />
                      {alteradoAposEnvio(l) && evento === 'S-1200' && <div style={{ color: '#6a1b9a', marginTop: 2 }}>Valores alterados após o envio</div>}
                    </td>
                    <td style={{ ...estiloTd, maxWidth: 340 }}>
                      {st === 'aceito' ? <span style={{ color: '#2e7d32' }}>Recibo {recibo ?? '—'}</span> : <ListaOcorrencias ocorrencias={ocorr} descricao={desc} />}
                    </td>
                    <td style={estiloTd}>{evento === 'S-1200' ? l.s1200_tentativas : l.s1210_tentativas}</td>
                    <td style={{ ...estiloTd, whiteSpace: 'nowrap' }}>
                      {grupoDaSituacao(st) === 'erros' && (
                        <IonButton style={podeEnviar ? undefined : { display: 'none' }} size="small" shape="round" fill="outline" color="medium" disabled={progresso.emAndamento}
                          onClick={() => enviar({ tipo: evento, competencia, candidatoIds: [l.candidato_id] })}>Reenviar</IonButton>
                      )}
                      {st === 'aceito' && aberta && (
                        <IonButton style={podeEnviar ? undefined : { display: 'none' }} size="small" shape="round" fill="outline" color="medium" disabled={progresso.emAndamento}
                          onClick={() => window.confirm(`Retificar o ${evento} de ${l.nome} com os valores atuais?`) && enviar({ tipo: evento, competencia, candidatoIds: [l.candidato_id], retificar: true })}>
                          Retificar
                        </IonButton>
                      )}{' '}
                      <IonButton size="small" shape="round" fill="outline" color="medium" onClick={() => setHistorico(l)}>Histórico</IonButton>{' '}
                      {!l.s1200_status && aberta && <IonButton style={podeImportar ? undefined : { display: 'none' }} size="small" shape="round" fill="outline" color="danger" onClick={() => remover(l)}>Remover</IonButton>}
                    </td>
                  </tr>
                );
              })}
              {!visiveis.length && (
                <tr><td colSpan={9} style={{ ...estiloTd, textAlign: 'center', color: '#888', padding: 24 }}>
                  {linhas.length ? 'Nenhum cooperado neste filtro.' : 'Nenhuma remuneração importada nesta competência.'}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      {historico && (
        <ModalHistorico candidatoId={historico.candidato_id} nome={historico.nome} tipo={evento} competencia={competencia} onFechar={() => setHistorico(null)} />
      )}
    </div>
  );
};

// ── Lotes ────────────────────────────────────────────────────────────────────

const ROTULO_LOTE: Record<LoteESocial['status'], string> = {
  enviando: 'Enviando', enviado: 'Aguardando processamento', processado: 'Processado',
  erro_envio: 'Falha no envio', erro_processamento: 'Rejeitado pelo eSocial',
};

const SecaoLotes: React.FC = () => {
  const [lotes, setLotes] = useState<LoteESocial[]>([]);
  const [erro, setErro] = useState('');
  const carregar = useCallback(() => { listarLotesESocial().then(setLotes).catch((e) => setErro(e.message)); }, []);
  useEffect(() => { carregar(); }, [carregar]);
  const { consultarRetornos, progresso } = useEnvioESocial(carregar);

  return (
    <div style={estiloCard}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, alignItems: 'center' }}>
        <div style={{ fontSize: 13, color: '#555' }}>
          Cada lote tem no máximo 50 eventos (limite do eSocial). {progresso.aguardandoRetorno > 0 && `${progresso.aguardandoRetorno} aguardando processamento.`}
        </div>
        <IonButton size="small" shape="round" fill="outline" color="success" onClick={() => { consultarRetornos(); carregar(); }}>Atualizar retornos</IonButton>
      </div>
      {erro && <div className="form-erro">{erro}</div>}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f5f5f5' }}>
              {['Lote', 'Evento', 'Competência', 'Eventos', 'Aceitos', 'Rejeitados', 'Situação', 'Protocolo', 'Enviado em', 'Por'].map((h) => <th key={h} style={estiloTh}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {lotes.map((l) => (
              <tr key={l.id}>
                <td style={estiloTd}>#{l.id}</td>
                <td style={estiloTd}>{l.tipo_evento}</td>
                <td style={estiloTd}>{formatarCompetencia(l.competencia)}</td>
                <td style={estiloTd}>{l.qtd_eventos}</td>
                <td style={{ ...estiloTd, color: '#2e7d32' }}>{l.aceitos}</td>
                <td style={{ ...estiloTd, color: '#b71c1c' }}>{l.rejeitados}</td>
                <td style={estiloTd}>
                  {ROTULO_LOTE[l.status] ?? l.status}
                  {(l.status === 'erro_envio' || l.status === 'erro_processamento') && l.desc_resposta && <div style={{ color: '#b71c1c' }}>{l.desc_resposta}</div>}
                </td>
                <td style={{ ...estiloTd, fontFamily: 'monospace', fontSize: 11 }}>{l.protocolo ?? '—'}</td>
                <td style={estiloTd}>{formatarDataHora(l.enviado_em)}</td>
                <td style={estiloTd}>{l.enviado_por_nome ?? '—'}</td>
              </tr>
            ))}
            {!lotes.length && <tr><td colSpan={10} style={{ ...estiloTd, textAlign: 'center', color: '#888', padding: 24 }}>Nenhum lote enviado neste ambiente.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ── Configuração ─────────────────────────────────────────────────────────────

const SecaoConfig: React.FC<{ config: ConfigESocial; certificado: SituacaoCertificado | null; onSalvo: () => void }> = ({ config, certificado, onSalvo }) => {
  const [form, setForm] = useState<ConfigESocial>(config);
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState('');
  const [erro, setErro] = useState('');
  const set = (k: keyof ConfigESocial, v: string | number) => setForm((f) => ({ ...f, [k]: v }));

  const salvar = async () => {
    setMsg(''); setErro('');
    if (Number(form.ambiente) === 1 && Number(config.ambiente) !== 1
      && !window.confirm('Mudar para PRODUÇÃO? A partir daqui os envios têm validade legal no eSocial.')) return;
    setSalvando(true);
    try {
      await salvarConfigESocial(form);
      setMsg('Configuração salva.');
      onSalvo();
    } catch (e) { setErro(e instanceof Error ? e.message : 'Erro ao salvar.'); }
    finally { setSalvando(false); }
  };

  const campo = (k: keyof ConfigESocial, rotulo: string, dica?: string) => (
    <div className="form-field">
      <label style={{ fontSize: 12, fontWeight: 600 }}>{rotulo}</label>
      <input className="form-input" value={String(form[k] ?? '')} onChange={(e) => set(k, e.target.value)} />
      {dica && <span className="form-hint">{dica}</span>}
    </div>
  );

  return (
    <div style={estiloCard}>
      <h4 style={{ marginTop: 0 }}>Certificado digital</h4>
      <p style={{ fontSize: 13, color: certificado?.valido ? '#2e7d32' : '#b71c1c' }}>
        {certificado?.valido
          ? `${certificado.titular} — válido até ${formatarDataIso(certificado.validoAte)}`
          : certificado?.erro ?? 'Não configurado.'}
      </p>
      <p className="form-hint">
        Por segurança o certificado A1 (.pfx) e a senha ficam nas variáveis de ambiente do servidor
        (ESOCIAL_CERT_PFX_BASE64 e ESOCIAL_CERT_SENHA), e não no banco de dados.
      </p>

      <h4>Empregador e transmissão</h4>
      <div className="form-row">
        <div className="form-field">
          <label style={{ fontSize: 12, fontWeight: 600 }}>Ambiente</label>
          <select className="form-input" value={form.ambiente} onChange={(e) => set('ambiente', Number(e.target.value))}>
            <option value={2}>Produção restrita (testes)</option>
            <option value={1}>Produção</option>
          </select>
        </div>
        {campo('nr_insc_empregador', 'CNPJ da cooperativa (14 dígitos)')}
        {campo('cnpj_transmissor', 'CNPJ do transmissor', 'Titular do certificado, se diferente da cooperativa.')}
      </div>
      <div className="form-row">
        {campo('cod_categ', 'Categoria do trabalhador', '731 = cooperado de cooperativa de trabalho.')}
        {campo('versao_layout', 'Versão do leiaute', 'v_S_01_03_00')}
      </div>

      <h4>Folha (S-1200)</h4>
      <div className="form-row">
        {campo('cnpj_estab', 'CNPJ do estabelecimento', 'Padrão quando a planilha não informa.')}
        {campo('cod_lotacao', 'Código da lotação tributária (S-1020)')}
        {campo('ide_tab_rubr', 'Identificador da tabela de rubricas (S-1010)')}
      </div>
      <div className="form-row">
        {campo('rubrica_remuneracao', 'Rubrica de remuneração (produção)')}
        {campo('rubrica_inss', 'Rubrica de desconto INSS')}
        {campo('rubrica_irrf', 'Rubrica de desconto IRRF')}
      </div>
      <p className="form-hint">
        As rubricas e a lotação precisam já estar cadastradas no eSocial (S-1010 e S-1020) com os mesmos códigos.
      </p>

      {erro && <div className="form-erro">{erro}</div>}
      {msg && <div style={{ color: '#2e7d32', fontSize: 13, marginBottom: 8 }}>{msg}</div>}
      <IonButton size="small" shape="round" color="success" disabled={salvando} onClick={salvar}>{salvando ? 'Salvando…' : 'Salvar configuração'}</IonButton>
      {config.atualizado_por_nome && <span className="form-hint" style={{ marginLeft: 12 }}>Última alteração: {config.atualizado_por_nome} em {formatarDataHora(config.atualizado_em)}</span>}
    </div>
  );
};

export default ESocialBeneficios;
