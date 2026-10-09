import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  OcorrenciaESocial, ResultadoEnvioLote, StatusEventoESocial, TentativaESocial, TipoEventoCooperado,
  consultarRetornosESocial, enviarLoteESocial, obterHistoricoESocial,
} from '../../../api/esocialApi';

// ── Situação ─────────────────────────────────────────────────────────────────

/** Agrupamento usado nos filtros: aceitos, com erro, aguardando retorno e não enviados. */
export type GrupoSituacao = 'todos' | 'aceitos' | 'erros' | 'aguardando' | 'nao_enviados';

export function grupoDaSituacao(status: StatusEventoESocial | null | undefined): Exclude<GrupoSituacao, 'todos'> {
  if (!status) return 'nao_enviados';
  if (status === 'aceito') return 'aceitos';
  if (status === 'enviando' || status === 'enviado') return 'aguardando';
  return 'erros';
}

const ROTULO_STATUS: Record<StatusEventoESocial | 'nao_enviado', { texto: string; cor: string; fundo: string }> = {
  nao_enviado: { texto: 'Não enviado', cor: '#616161', fundo: '#f1f3f4' },
  invalido: { texto: 'Erro de cadastro', cor: '#b71c1c', fundo: '#ffebee' },
  enviando: { texto: 'Enviando', cor: '#e65100', fundo: '#fff3e0' },
  enviado: { texto: 'Aguardando retorno', cor: '#e65100', fundo: '#fff3e0' },
  aceito: { texto: 'Aceito', cor: '#2e7d32', fundo: '#e8f5e9' },
  rejeitado: { texto: 'Rejeitado', cor: '#b71c1c', fundo: '#ffebee' },
  erro_envio: { texto: 'Falha no envio', cor: '#b71c1c', fundo: '#ffebee' },
};

export const BadgeStatus: React.FC<{ status: StatusEventoESocial | null | undefined; sufixo?: string }> = ({ status, sufixo }) => {
  const r = ROTULO_STATUS[status ?? 'nao_enviado'];
  return (
    <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 700, color: r.cor, background: r.fundo, whiteSpace: 'nowrap' }}>
      {r.texto}{sufixo ? ` ${sufixo}` : ''}
    </span>
  );
};

export const FiltroSituacao: React.FC<{
  valor: GrupoSituacao;
  onChange: (g: GrupoSituacao) => void;
  contagem: Record<GrupoSituacao, number>;
}> = ({ valor, onChange, contagem }) => {
  const opcoes: { id: GrupoSituacao; texto: string; cor: string }[] = [
    { id: 'todos', texto: 'Todos', cor: '#1565c0' },
    { id: 'aceitos', texto: 'Aceitos', cor: '#2e7d32' },
    { id: 'erros', texto: 'Com erro', cor: '#c62828' },
    { id: 'aguardando', texto: 'Aguardando retorno', cor: '#e65100' },
    { id: 'nao_enviados', texto: 'Não enviados', cor: '#616161' },
  ];
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {opcoes.map((o) => {
        const ativo = valor === o.id;
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => onChange(o.id)}
            style={{
              padding: '5px 12px', borderRadius: 16, fontSize: 12, cursor: 'pointer', fontWeight: ativo ? 700 : 500,
              border: `1px solid ${o.cor}`, background: ativo ? o.cor : '#fff', color: ativo ? '#fff' : o.cor,
            }}
          >
            {o.texto} ({contagem[o.id] ?? 0})
          </button>
        );
      })}
    </div>
  );
};

export function contarGrupos<T>(itens: T[], status: (i: T) => StatusEventoESocial | null | undefined): Record<GrupoSituacao, number> {
  const c: Record<GrupoSituacao, number> = { todos: itens.length, aceitos: 0, erros: 0, aguardando: 0, nao_enviados: 0 };
  for (const i of itens) c[grupoDaSituacao(status(i))]++;
  return c;
}

export const ListaOcorrencias: React.FC<{ ocorrencias: OcorrenciaESocial[]; descricao?: string | null }> = ({ ocorrencias, descricao }) => {
  if (!ocorrencias?.length) return descricao ? <div style={{ fontSize: 12, color: '#b71c1c' }}>{descricao}</div> : null;
  return (
    <ul style={{ margin: '4px 0 0', paddingLeft: 18, fontSize: 12, color: '#b71c1c' }}>
      {ocorrencias.map((o, i) => (
        <li key={i}>
          {o.codigo && o.codigo !== 'VALIDACAO' ? <strong>[{o.codigo}] </strong> : null}
          {o.descricao}
          {o.localizacao ? <span style={{ color: '#888' }}> — {o.localizacao}</span> : null}
        </li>
      ))}
    </ul>
  );
};

// ── Formatação ───────────────────────────────────────────────────────────────

export function formatarMoeda(v: number | string | null | undefined) {
  if (v === null || v === undefined || v === '') return '—';
  return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function formatarDataHora(v: string | null | undefined) {
  if (!v) return '—';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? v : d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

export function formatarDataIso(v: string | null | undefined) {
  if (!v) return '—';
  const [y, m, d] = v.slice(0, 10).split('-');
  return d ? `${d}/${m}/${y}` : v;
}

export function formatarCompetencia(c: string | null | undefined) {
  if (!c) return '—';
  const [y, m] = c.split('-');
  return `${m}/${y}`;
}

export function competenciaAnterior(base = new Date()) {
  const d = new Date(base.getFullYear(), base.getMonth() - 1, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// ── Envio em lotes com acompanhamento ────────────────────────────────────────

export interface ProgressoEnvio {
  emAndamento: boolean;
  lotesEnviados: number;
  eventosEnviados: number;
  invalidos: ResultadoEnvioLote['invalidos'];
  ignorados: ResultadoEnvioLote['ignorados'];
  falhas: string[];
  restantes: number;
  aguardandoRetorno: number;
}

const PROGRESSO_INICIAL: ProgressoEnvio = {
  emAndamento: false, lotesEnviados: 0, eventosEnviados: 0, invalidos: [], ignorados: [], falhas: [], restantes: 0, aguardandoRetorno: 0,
};

/**
 * Envia os eventos lote a lote (máx. 50 por lote, limite do eSocial) até não
 * restar nenhum cooperado, e depois consulta os retornos periodicamente
 * enquanto houver lotes aguardando processamento.
 */
export function useEnvioESocial(onAtualizar: () => void) {
  const [progresso, setProgresso] = useState<ProgressoEnvio>(PROGRESSO_INICIAL);
  const montado = useRef(true);
  const consultando = useRef(false);
  const atualizarRef = useRef(onAtualizar);
  atualizarRef.current = onAtualizar;

  useEffect(() => () => { montado.current = false; }, []);

  const consultarRetornos = useCallback(async () => {
    if (consultando.current) return;
    consultando.current = true;
    try {
      // eSocial costuma levar de segundos a alguns minutos para processar; consulta por até ~10 min
      for (let i = 0; i < 75 && montado.current; i++) {
        const r = await consultarRetornosESocial();
        if (r.consultados.some((c) => c.processado)) atualizarRef.current();
        if (!montado.current) break;
        setProgresso((p) => ({ ...p, aguardandoRetorno: r.aguardando }));
        if (r.aguardando === 0) break;
        await new Promise((ok) => setTimeout(ok, 8000));
      }
    } catch (e) {
      if (montado.current) setProgresso((p) => ({ ...p, falhas: [...p.falhas, e instanceof Error ? e.message : 'Erro ao consultar retornos.'] }));
    } finally {
      consultando.current = false;
    }
  }, []);

  /** Sem `candidatoIds`: envia todos os pendentes; com ids: reenvia em grupos de até 50. */
  const enviar = useCallback(async (params: { tipo: TipoEventoCooperado; competencia?: string; candidatoIds?: number[]; retificar?: boolean }) => {
    setProgresso({ ...PROGRESSO_INICIAL, emAndamento: true });
    const grupos = params.candidatoIds?.length
      ? Array.from({ length: Math.ceil(params.candidatoIds.length / 50) }, (_, i) => params.candidatoIds!.slice(i * 50, i * 50 + 50))
      : null;
    try {
      let restantes = 1;
      let i = 0;
      let anterior = -1;
      while (montado.current && (grupos ? i < grupos.length : restantes > 0)) {
        const r = await enviarLoteESocial({ ...params, candidatoIds: grupos ? grupos[i] : undefined });
        i++;
        restantes = grupos ? grupos.length - i : r.restantes;
        setProgresso((p) => ({
          ...p,
          lotesEnviados: p.lotesEnviados + (r.lote ? 1 : 0),
          eventosEnviados: p.eventosEnviados + r.enviados,
          invalidos: [...p.invalidos, ...r.invalidos],
          ignorados: [...p.ignorados, ...r.ignorados],
          falhas: r.lote && !r.lote.recebido ? [...p.falhas, r.lote.mensagem] : p.falhas,
          restantes,
        }));
        atualizarRef.current();
        // Segurança: se o servidor não avançou, interrompe em vez de repetir indefinidamente
        if (!grupos && restantes === anterior && !r.lote && !r.invalidos.length) break;
        anterior = restantes;
      }
    } catch (e) {
      setProgresso((p) => ({ ...p, falhas: [...p.falhas, e instanceof Error ? e.message : 'Erro ao enviar ao eSocial.'] }));
    } finally {
      if (montado.current) setProgresso((p) => ({ ...p, emAndamento: false }));
    }
    consultarRetornos();
  }, [consultarRetornos]);

  const limpar = useCallback(() => setProgresso(PROGRESSO_INICIAL), []);

  return { progresso, enviar, consultarRetornos, limpar };
}

export const PainelProgresso: React.FC<{ progresso: ProgressoEnvio; onFechar: () => void }> = ({ progresso: p, onFechar }) => {
  const temAlgo = p.emAndamento || p.lotesEnviados || p.invalidos.length || p.ignorados.length || p.falhas.length || p.aguardandoRetorno;
  if (!temAlgo) return null;
  return (
    <div style={{ border: '1px solid #bbdefb', background: '#f5faff', borderRadius: 10, padding: 14, marginBottom: 16, fontSize: 13 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <strong style={{ color: '#0d47a1' }}>
          {p.emAndamento
            ? `Enviando… ${p.lotesEnviados} lote(s), ${p.eventosEnviados} evento(s)${p.restantes ? ` — restam ${p.restantes}` : ''}`
            : `Envio concluído: ${p.lotesEnviados} lote(s), ${p.eventosEnviados} evento(s) transmitido(s).`}
        </strong>
        {!p.emAndamento && <button type="button" className="btn-secundario" onClick={onFechar}>Fechar</button>}
      </div>
      {p.aguardandoRetorno > 0 && (
        <div style={{ marginTop: 6, color: '#e65100' }}>
          {p.aguardandoRetorno} lote(s) aguardando processamento no eSocial; os resultados são atualizados automaticamente.
        </div>
      )}
      {p.falhas.map((f, i) => <div key={i} style={{ marginTop: 6, color: '#b71c1c' }}>⚠ {f}</div>)}
      {p.invalidos.length > 0 && (
        <details style={{ marginTop: 8 }}>
          <summary style={{ cursor: 'pointer', color: '#b71c1c', fontWeight: 600 }}>
            {p.invalidos.length} cooperado(s) não enviado(s) por erro de cadastro
          </summary>
          <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
            {p.invalidos.map((i) => <li key={i.candidatoId}><strong>{i.nome ?? `#${i.candidatoId}`}</strong>: {i.erros.join(' ')}</li>)}
          </ul>
        </details>
      )}
      {p.ignorados.length > 0 && (
        <details style={{ marginTop: 8 }}>
          <summary style={{ cursor: 'pointer', color: '#616161' }}>{p.ignorados.length} cooperado(s) ignorado(s)</summary>
          <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
            {p.ignorados.map((i) => <li key={i.candidatoId}><strong>{i.nome ?? `#${i.candidatoId}`}</strong>: {i.motivo}</li>)}
          </ul>
        </details>
      )}
    </div>
  );
};

// ── Histórico de tentativas ──────────────────────────────────────────────────

const ROTULO_TIPO: Record<string, string> = {
  'S-2300': 'Cadastro (S-2300)', 'S-1200': 'Remuneração (S-1200)', 'S-1210': 'Pagamento (S-1210)',
  'S-1299': 'Fechamento (S-1299)', 'S-1298': 'Reabertura (S-1298)',
};

export const TabelaTentativas: React.FC<{ tentativas: TentativaESocial[]; tipo?: string; competencia?: string }> = ({ tentativas, tipo, competencia }) => {
  const filtradas = tentativas.filter((t) => (!tipo || t.tipo === tipo) && (!competencia || t.competencia === competencia));
  if (!filtradas.length) return <div style={{ color: '#888', fontSize: 13, padding: 12 }}>Nenhuma tentativa de envio registrada.</div>;
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ background: '#f5f5f5', textAlign: 'left' }}>
            {['#', 'Evento', 'Competência', 'Data', 'Situação', 'Detalhes', 'Recibo / Protocolo', 'Por'].map((h) => (
              <th key={h} style={{ padding: '8px 10px', borderBottom: '1px solid #e0e0e0' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filtradas.map((t, i) => (
            <tr key={t.id} style={{ borderBottom: '1px solid #f0f0f0', verticalAlign: 'top' }}>
              <td style={{ padding: '8px 10px' }}>{filtradas.length - i}</td>
              <td style={{ padding: '8px 10px' }}>
                {ROTULO_TIPO[t.tipo] ?? t.tipo}
                {t.ind_retif === 2 && <div style={{ color: '#6a1b9a', fontWeight: 600 }}>Retificação</div>}
                {t.origem === 'externo' && <div style={{ color: '#616161' }}>Outro sistema</div>}
              </td>
              <td style={{ padding: '8px 10px' }}>
                {formatarCompetencia(t.competencia)}
                {t.per_apur && t.per_apur !== t.competencia && <div style={{ color: '#888' }}>pago em {formatarCompetencia(t.per_apur)}</div>}
              </td>
              <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>{formatarDataHora(t.criado_em)}</td>
              <td style={{ padding: '8px 10px' }}><BadgeStatus status={t.status} /></td>
              <td style={{ padding: '8px 10px', maxWidth: 380 }}>
                {t.status === 'aceito'
                  ? <span style={{ color: '#2e7d32' }}>{t.desc_resposta || 'Processado com sucesso.'}</span>
                  : <ListaOcorrencias ocorrencias={t.ocorrencias} descricao={t.desc_resposta} />}
              </td>
              <td style={{ padding: '8px 10px', fontFamily: 'monospace', fontSize: 11 }}>
                {t.nr_recibo ?? '—'}
                {t.protocolo && <div style={{ color: '#888' }}>{t.protocolo}</div>}
              </td>
              <td style={{ padding: '8px 10px' }}>{t.enviado_por_nome ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export const ModalHistorico: React.FC<{
  candidatoId: number;
  nome: string;
  tipo?: string;
  competencia?: string;
  onFechar: () => void;
}> = ({ candidatoId, nome, tipo, competencia, onFechar }) => {
  const [tentativas, setTentativas] = useState<TentativaESocial[] | null>(null);
  const [erro, setErro] = useState('');
  useEffect(() => {
    obterHistoricoESocial(candidatoId).then(setTentativas).catch((e) => setErro(e.message));
  }, [candidatoId]);
  return (
    <div
      onClick={onFechar}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
    >
      <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 12, width: 'min(1000px, 100%)', maxHeight: '85vh', overflow: 'auto', padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: 16 }}>Tentativas de envio — {nome}{tipo ? ` · ${ROTULO_TIPO[tipo] ?? tipo}` : ''}</h3>
          <button type="button" className="btn-secundario" onClick={onFechar}>Fechar</button>
        </div>
        {erro && <div className="form-erro">{erro}</div>}
        {!tentativas && !erro && <div style={{ color: '#888' }}>Carregando…</div>}
        {tentativas && <TabelaTentativas tentativas={tentativas} tipo={tipo} competencia={competencia} />}
      </div>
    </div>
  );
};

// ── Planilha (CSV) ───────────────────────────────────────────────────────────

/** Lê CSV separado por ";" ou "," (detecta pelo cabeçalho), com suporte a aspas. */
export function lerCsv(texto: string): string[][] {
  const limpo = texto.replace(/^﻿/, '');
  const primeiraLinha = limpo.split(/\r?\n/, 1)[0] ?? '';
  const sep = (primeiraLinha.match(/;/g)?.length ?? 0) >= (primeiraLinha.match(/,/g)?.length ?? 0) ? ';' : ',';
  const linhas: string[][] = [];
  let campo = '';
  let linha: string[] = [];
  let aspas = false;
  for (let i = 0; i < limpo.length; i++) {
    const ch = limpo[i];
    if (aspas) {
      if (ch === '"' && limpo[i + 1] === '"') { campo += '"'; i++; }
      else if (ch === '"') aspas = false;
      else campo += ch;
    } else if (ch === '"') aspas = true;
    else if (ch === sep) { linha.push(campo); campo = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && limpo[i + 1] === '\n') i++;
      linha.push(campo); campo = '';
      if (linha.some((c) => c.trim())) linhas.push(linha);
      linha = [];
    } else campo += ch;
  }
  linha.push(campo);
  if (linha.some((c) => c.trim())) linhas.push(linha);
  return linhas;
}

/** Normaliza o nome da coluna: sem acento, minúsculo, "_" no lugar de espaços. */
export function normalizarCabecalho(h: string) {
  return h.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

export function baixarArquivo(nome: string, conteudo: string, tipo = 'text/csv;charset=utf-8') {
  const blob = new Blob(['﻿' + conteudo], { type: tipo });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
