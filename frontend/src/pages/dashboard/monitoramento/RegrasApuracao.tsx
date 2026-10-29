import React, { useEffect, useMemo, useState } from 'react';
import { useToast } from '../../../components/ToastContext';
import { parseDataHoraServidor } from '../../../utils/formatters';
import { rotuloTipoUsuario, TipoUsuario } from '../../../api/usuariosApi';
import {
  ClienteComRegra,
  HistoricoRegraApuracao,
  RegrasApuracao as Regras,
  listarClientesComRegraApuracao,
  listarHistoricoRegraApuracao,
  obterOpcoesEscala,
  obterRegrasApuracao,
  restaurarRegrasApuracaoPadrao,
  salvarRegrasApuracao,
} from '../../../api/escalaFaturamentoApi';

const rotuloPerfil = (p?: string | null) => (p ? rotuloTipoUsuario(p as TipoUsuario).replace(/ \(.*\)$/, '') : '');
const dataHora = (v?: string | null) => {
  if (!v) return '';
  const d = parseDataHoraServidor(v);
  return isNaN(d.getTime()) ? v : `${d.toLocaleDateString('pt-BR')} às ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
};

// Nome de cada regra no histórico e formatação do valor
const ROTULO_CAMPO: Partial<Record<keyof Regras, string>> = {
  tolerancia_minutos: 'Tolerância de hora extra (min)',
  tolerancia_falta_minutos: 'Tolerância de falta/atraso (min)',
  limite_entrada_antecipada_minutos: 'Entrada antecipada conta até (min antes)',
  limite_saida_posterior_minutos: 'Saída após o horário conta até (min depois)',
  arredondamento_minutos: 'Arredondamento (min)',
  noturno_inicio: 'Início do adicional noturno',
  noturno_fim: 'Fim do adicional noturno',
  hora_noturna_reduzida: 'Hora noturna reduzida',
  extras_automaticos: 'Extra e falta automáticas',
  plantao_sem_batida_gera_falta: 'Plantão sem batida gera falta',
  refeicao_nao_registrada: 'Refeição não registrada',
  pausa_nao_registrada: 'Pausa não registrada',
  jornada_maxima_horas: 'Entrada sem saída após (h)',
  janela_escala_horas: 'Tolerância para casar com a escala (h)',
};
const valorTexto = (v: unknown) => {
  if (v === null || v === undefined || v === '') return 'sem limite';
  if (v === true) return 'Sim';
  if (v === false) return 'Não';
  if (v === 'descontar_parametro') return 'Descontar o tempo da vaga';
  if (v === 'nao_descontar') return 'Não descontar';
  return String(v);
};
const ROTULO_ACAO: Record<HistoricoRegraApuracao['acao'], string> = {
  personalizacao: 'Regra própria criada',
  alteracao: 'Regra alterada',
  restauracao_padrao: 'Voltou ao padrão do sistema',
};

const Secao: React.FC<{ titulo: string; children: React.ReactNode }> = ({ titulo, children }) => (
  <div style={{ padding: '4px 24px 18px' }}>
    <h4 style={{ margin: '8px 0 12px', fontSize: 14, color: '#0f172a', borderBottom: '1px solid #e2e8f0', paddingBottom: 6 }}>{titulo}</h4>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 18 }}>{children}</div>
  </div>
);
const Ajuda: React.FC<{ children: React.ReactNode }> = ({ children }) => <small style={{ color: '#64748b' }}>{children}</small>;

/** Regras de apuração das jornadas, por cliente (menu Supervisão). */
export const RegrasApuracao: React.FC = () => {
  const { showToast } = useToast();
  const [empresas, setEmpresas] = useState<{ id: number; nome_empresa: string }[]>([]);
  const [comRegra, setComRegra] = useState<ClienteComRegra[]>([]);
  const [empresaId, setEmpresaId] = useState<number | ''>('');
  const [busca, setBusca] = useState('');
  const [regras, setRegras] = useState<Regras | null>(null);
  const [historico, setHistorico] = useState<HistoricoRegraApuracao[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const carregarClientes = () => listarClientesComRegraApuracao().then(setComRegra).catch(() => setComRegra([]));
  useEffect(() => {
    obterOpcoesEscala().then((o) => setEmpresas(o.empresas)).catch((e) => showToast(e?.message || 'Erro ao carregar clientes.', 'error'));
    carregarClientes();
  }, []);

  const carregarRegra = async (id: number) => {
    setCarregando(true);
    try {
      const [r, h] = await Promise.all([obterRegrasApuracao(id), listarHistoricoRegraApuracao(id)]);
      setRegras(r);
      setHistorico(h);
    } catch (e: any) {
      showToast(e?.message || 'Erro ao carregar a regra do cliente.', 'error');
    } finally {
      setCarregando(false);
    }
  };
  useEffect(() => {
    setRegras(null);
    setHistorico([]);
    if (empresaId) carregarRegra(Number(empresaId));
  }, [empresaId]);

  const idsComRegra = useMemo(() => new Set(comRegra.map((c) => c.empresa_id)), [comRegra]);
  const empresasFiltradas = useMemo(() => {
    const b = busca.trim().toLowerCase();
    return b ? empresas.filter((e) => e.nome_empresa.toLowerCase().includes(b)) : empresas;
  }, [empresas, busca]);
  const cliente = empresas.find((e) => e.id === empresaId);

  const upd = <K extends keyof Regras>(k: K, v: Regras[K]) => setRegras((r) => (r ? { ...r, [k]: v } : r));
  const numOuNulo = (v: string) => (v === '' ? null : Number(v));

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regras || !empresaId) return;
    setSalvando(true);
    try {
      await salvarRegrasApuracao(Number(empresaId), regras);
      showToast(`Regra de apuração de ${cliente?.nome_empresa} salva. Reapure os processos abertos deste cliente para aplicar.`, 'success');
      await Promise.all([carregarRegra(Number(empresaId)), carregarClientes()]);
    } catch (err: any) {
      showToast(err?.message || 'Erro ao salvar.', 'error');
    } finally {
      setSalvando(false);
    }
  };

  const restaurar = async () => {
    if (!empresaId || !window.confirm(`Remover a regra própria de ${cliente?.nome_empresa}? O cliente volta a usar o padrão do sistema.`)) return;
    setSalvando(true);
    try {
      await restaurarRegrasApuracaoPadrao(Number(empresaId));
      showToast('Cliente voltou a usar o padrão do sistema.', 'success');
      await Promise.all([carregarRegra(Number(empresaId)), carregarClientes()]);
    } catch (err: any) {
      showToast(err?.message || 'Erro ao restaurar o padrão.', 'error');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <>
      {/* ── Seleção do cliente ── */}
      <div className="monitoramento-filters-card">
        <div className="filter-item" style={{ flex: 1, minWidth: 220 }}>
          <label htmlFor="ra-busca">Buscar cliente</label>
          <input id="ra-busca" className="filter-input" placeholder="Digite o nome do cliente..." value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
        <div className="filter-item" style={{ flex: 2, minWidth: 260 }}>
          <label htmlFor="ra-cliente">Cliente da regra de apuração *</label>
          <select id="ra-cliente" className="filter-select" value={empresaId} onChange={(e) => setEmpresaId(e.target.value ? Number(e.target.value) : '')}>
            <option value="">— Selecione o cliente —</option>
            {empresasFiltradas.map((e) => (
              <option key={e.id} value={e.id}>{e.nome_empresa}{idsComRegra.has(e.id) ? '  • regra própria' : ''}</option>
            ))}
          </select>
        </div>
        <div className="filter-item" style={{ justifyContent: 'flex-end', fontSize: 12.5, color: '#64748b' }}>
          {comRegra.length} cliente(s) com regra própria
        </div>
      </div>

      {!empresaId ? (
        <div className="monitoramento-table-card" style={{ padding: 28, color: '#64748b', textAlign: 'center' }}>
          Selecione o cliente para ver e personalizar a regra de apuração dele. Cada cliente tem a sua regra; quem não tiver uma própria usa o padrão do sistema.
        </div>
      ) : !regras || carregando ? (
        <div className="monitoramento-table-card" style={{ padding: 24, color: '#94a3b8' }}>Carregando regra do cliente...</div>
      ) : (
        <>
          <form className="monitoramento-table-card" onSubmit={salvar}>
            <div className="table-card-header" style={{ flexWrap: 'wrap', gap: 10 }}>
              <div>
                <h3 className="table-card-title">Regra de apuração — {cliente?.nome_empresa}</h3>
                <p style={{ margin: '6px 0 0 0', fontSize: 13, color: '#64748b' }}>
                  {regras.personalizadas ? (
                    <>
                      <span className="badge-status" style={{ background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0', marginRight: 6 }}>Regra própria do cliente</span>
                      Última alteração por <strong>{regras.atualizado_por_nome ?? '—'}</strong>
                      {regras.atualizado_por_perfil && ` (${rotuloPerfil(regras.atualizado_por_perfil)})`}
                      {regras.atualizado_em && ` em ${dataHora(regras.atualizado_em)}`}.
                    </>
                  ) : (
                    <>
                      <span className="badge-status" style={{ background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0', marginRight: 6 }}>Padrão do sistema</span>
                      Este cliente ainda não tem regra própria. Ao salvar, os valores abaixo passam a ser a regra dele.
                    </>
                  )}
                  {' '}Vale para a planilha e para novas apurações dos processos de faturamento deste cliente.
                </p>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {regras.personalizadas && (
                  <button type="button" className="btn-cancel" onClick={restaurar} disabled={salvando}>Voltar ao padrão</button>
                )}
                <button type="submit" className="btn-primary-filter" disabled={salvando}>
                  {salvando ? 'Salvando...' : regras.personalizadas ? 'Salvar regra do cliente' : 'Personalizar para este cliente'}
                </button>
              </div>
            </div>

            <Secao titulo="Horas extras, faltas e atrasos">
              <div className="filter-item">
                <label htmlFor="ra-tol">Tolerância de hora extra (min por plantão)</label>
                <input id="ra-tol" type="number" min={0} max={120} className="filter-input" value={regras.tolerancia_minutos} onChange={(e) => upd('tolerancia_minutos', Number(e.target.value))} />
                <Ajuda>Excedente até este limite não gera extra. Acima dele, conta a diferença inteira (CLT art. 58 §1º usa 10 min).</Ajuda>
              </div>
              <div className="filter-item">
                <label htmlFor="ra-tolf">Tolerância de falta/atraso (min por plantão)</label>
                <input id="ra-tolf" type="number" min={0} max={120} className="filter-input" value={regras.tolerancia_falta_minutos} onChange={(e) => upd('tolerancia_falta_minutos', Number(e.target.value))} />
                <Ajuda>Atraso ou saída antecipada até este limite não gera falta.</Ajuda>
              </div>
              <div className="filter-item">
                <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input type="checkbox" checked={regras.extras_automaticos} onChange={(e) => upd('extras_automaticos', e.target.checked)} />
                  Apurar extra e falta automaticamente
                </label>
                <Ajuda>Desligue se a Supervisão lançar as horas extras só como complemento (evita contar em dobro).</Ajuda>
              </div>
              <div className="filter-item">
                <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input type="checkbox" checked={regras.plantao_sem_batida_gera_falta} onChange={(e) => upd('plantao_sem_batida_gera_falta', e.target.checked)} />
                  Plantão da escala sem batida no App gera falta
                </label>
                <Ajuda>Plantão previsto e já passado, sem nenhum registro no App. A inconsistência aparece mesmo desligado.</Ajuda>
              </div>
            </Secao>

            <Secao titulo="Entrada e saída fora do horário previsto">
              <div className="filter-item">
                <label htmlFor="ra-ant">Entrada antecipada conta até (min antes do início)</label>
                <input id="ra-ant" type="number" min={0} max={240} className="filter-input" placeholder="Sem limite"
                  value={regras.limite_entrada_antecipada_minutos ?? ''} onChange={(e) => upd('limite_entrada_antecipada_minutos', numOuNulo(e.target.value))} />
                <Ajuda>Ex.: 15 = quem bate 1h antes só tem contados os 15 min antes do plantão. 0 = conta só a partir do horário. Vazio = conta desde a batida.</Ajuda>
              </div>
              <div className="filter-item">
                <label htmlFor="ra-pos">Saída após o horário conta até (min depois do fim)</label>
                <input id="ra-pos" type="number" min={0} max={240} className="filter-input" placeholder="Sem limite"
                  value={regras.limite_saida_posterior_minutos ?? ''} onChange={(e) => upd('limite_saida_posterior_minutos', numOuNulo(e.target.value))} />
                <Ajuda>Mesmo critério para a saída. O horário previsto vem do plantão da escala ou, sem escala, do horário da vaga no Parâmetro.</Ajuda>
              </div>
              <div className="filter-item">
                <label htmlFor="ra-arr">Arredondamento das horas trabalhadas</label>
                <select id="ra-arr" className="filter-select" value={regras.arredondamento_minutos} onChange={(e) => upd('arredondamento_minutos', Number(e.target.value) as Regras['arredondamento_minutos'])}>
                  <option value={0}>Sem arredondamento</option>
                  <option value={5}>Para os 5 min mais próximos</option>
                  <option value={10}>Para os 10 min mais próximos</option>
                  <option value={15}>Para os 15 min mais próximos</option>
                  <option value={30}>Para os 30 min mais próximos</option>
                </select>
                <Ajuda>Aplicado em cada jornada, antes de calcular extra e falta.</Ajuda>
              </div>
            </Secao>

            <Secao titulo="Refeição e pausa">
              <div className="filter-item">
                <label htmlFor="ra-ref">Refeição não registrada no App</label>
                <select id="ra-ref" className="filter-select" value={regras.refeicao_nao_registrada} onChange={(e) => upd('refeicao_nao_registrada', e.target.value as Regras['refeicao_nao_registrada'])}>
                  <option value="descontar_parametro">Descontar o tempo de refeição da vaga</option>
                  <option value="nao_descontar">Não descontar</option>
                </select>
                <Ajuda>Só se aplica às vagas que descontam refeição.</Ajuda>
              </div>
              <div className="filter-item">
                <label htmlFor="ra-pau">Pausa não registrada no App</label>
                <select id="ra-pau" className="filter-select" value={regras.pausa_nao_registrada} onChange={(e) => upd('pausa_nao_registrada', e.target.value as Regras['pausa_nao_registrada'])}>
                  <option value="nao_descontar">Não descontar</option>
                  <option value="descontar_parametro">Descontar o tempo de pausa da vaga</option>
                </select>
                <Ajuda>Só se aplica às vagas que descontam pausa.</Ajuda>
              </div>
            </Secao>

            <Secao titulo="Adicional noturno">
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
                <Ajuda>O adicional só é pago nas vagas marcadas com adicional noturno no Parâmetro.</Ajuda>
              </div>
            </Secao>

            <Secao titulo="Leitura das batidas">
              <div className="filter-item">
                <label htmlFor="ra-max">Entrada sem saída após (h)</label>
                <input id="ra-max" type="number" min={12} max={48} className="filter-input" value={regras.jornada_maxima_horas} onChange={(e) => upd('jornada_maxima_horas', Number(e.target.value))} />
                <Ajuda>Acima disso a entrada é considerada sem saída, em vez de casar com a saída de outro plantão.</Ajuda>
              </div>
              <div className="filter-item">
                <label htmlFor="ra-jan">Tolerância para casar com a escala (h)</label>
                <input id="ra-jan" type="number" min={1} max={12} className="filter-input" value={regras.janela_escala_horas} onChange={(e) => upd('janela_escala_horas', Number(e.target.value))} />
                <Ajuda>Entrada até este tempo antes/depois do início previsto é ligada ao plantão da escala.</Ajuda>
              </div>
            </Secao>
          </form>

          {/* ── Histórico de alterações da regra do cliente ── */}
          <div className="monitoramento-table-card">
            <div className="table-card-header">
              <div>
                <h3 className="table-card-title">Histórico da regra de {cliente?.nome_empresa}</h3>
                <p style={{ margin: '4px 0 0 0', fontSize: 13, color: '#64748b' }}>Cada alteração com o que mudou, quem alterou (nome e perfil), data e hora.</p>
              </div>
            </div>
            <div style={{ padding: '0 24px 20px' }}>
              {historico.length === 0 ? (
                <div style={{ padding: 20, textAlign: 'center', color: '#94a3b8' }}>Nenhuma alteração registrada para este cliente.</div>
              ) : historico.map((h) => (
                <div key={h.id} style={{ borderLeft: '3px solid #4a9e4f', padding: '8px 12px', marginBottom: 10, background: '#f8fafc', borderRadius: 6 }}>
                  <div style={{ fontSize: 13, color: '#0f172a' }}>
                    <strong>{ROTULO_ACAO[h.acao]}</strong> por <strong>{h.usuario_nome ?? '—'}</strong>
                    {h.usuario_perfil && ` (${rotuloPerfil(h.usuario_perfil)})`} em {dataHora(h.criado_em)}
                  </div>
                  {h.alteracoes.length > 0 && (
                    <ul style={{ margin: '6px 0 0', paddingLeft: 18, fontSize: 12.5, color: '#475569' }}>
                      {h.alteracoes.map((a) => (
                        <li key={a.campo}>
                          {ROTULO_CAMPO[a.campo] ?? a.campo}: <span style={{ textDecoration: 'line-through' }}>{valorTexto(a.anterior)}</span> → <strong>{valorTexto(a.novo)}</strong>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </>
  );
};

export default RegrasApuracao;
