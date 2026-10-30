import { ApontamentoDetalhado } from '../../../api/monitoramentoApi';
import { formatarCPF } from '../../../utils/formatters';
import { addDias, agruparJornadas, horaDe, LinhaJornada } from './jornadaApontamentos';

// ── Folha de apontamentos ───────────────────────────────────────────────────
// Uma folha por cooperado, com todos os dias do período e as batidas de cada jornada, para
// conferência e assinatura. Traz só o que foi registrado: horas e valores vêm da apuração.

export interface CooperadoFolha { id: number; nome: string; cpf?: string | null; matricula?: string | null; atividade?: string | null }
export interface LinhaFolha { data: string; entrada: string; refeicaoInicio: string; refeicaoFim: string; saida: string; ajustado: boolean }
export interface Folha { cooperado: CooperadoFolha; linhas: LinhaFolha[]; diasComRegistro: number }

const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
const dataBR = (iso: string) => iso.split('-').reverse().join('/');
const diaSemana = (iso: string) => {
  const [a, m, d] = iso.split('-').map(Number);
  return DIAS[new Date(a, m - 1, d).getDay()];
};
const hora = (ap: ApontamentoDetalhado | null | undefined) => (ap ? horaDe(ap) : '');

function linhaDe(j: LinhaJornada): LinhaFolha {
  return {
    data: j.data,
    entrada: hora(j.entrada),
    refeicaoInicio: hora(j.refeicoes[0]?.ini),
    refeicaoFim: hora(j.refeicoes[0]?.fim),
    saida: hora(j.saida),
    ajustado: j.batidas.some((b) => b.ajustado === 1),
  };
}

/** Monta as folhas: cooperados do projeto mais quem tem batida no cliente no período. */
export function montarFolhas(cooperados: CooperadoFolha[], apontamentos: ApontamentoDetalhado[], inicio: string, fim: string): Folha[] {
  const porId = new Map(cooperados.map((c) => [c.id, c]));
  for (const ap of apontamentos) {
    if (!porId.has(ap.candidato_id)) {
      porId.set(ap.candidato_id, { id: ap.candidato_id, nome: ap.candidato_nome ?? `Cooperado #${ap.candidato_id}`, cpf: ap.candidato_cpf, matricula: ap.candidato_matricula, atividade: ap.vaga_cargo });
    }
  }
  const jornadas = agruparJornadas(apontamentos);
  const datas: string[] = [];
  for (let d = inicio; d <= fim; d = addDias(d, 1)) datas.push(d);

  return [...porId.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')).map((cooperado) => {
    const doCooperado = jornadas.filter((j) => j.candidatoId === cooperado.id && j.data >= inicio && j.data <= fim);
    const linhas = datas.flatMap((data) => {
      const doDia = doCooperado.filter((j) => j.data === data);
      return doDia.length ? doDia.map(linhaDe) : [{ data, entrada: '', refeicaoInicio: '', refeicaoFim: '', saida: '', ajustado: false }];
    });
    return { cooperado, linhas, diasComRegistro: new Set(doCooperado.map((j) => j.data)).size };
  });
}

/** Documento HTML para impressão/PDF: cada folha começa em uma página nova. */
export function htmlFolhas(folhas: Folha[], { cliente, inicio, fim }: { cliente: string; inicio: string; fim: string }): string {
  const paginas = folhas.map((f) => `
    <section class="folha">
      <header>
        <div><h1>ATESA COOPERATIVA DE TRABALHO</h1><p>Folha de Apontamentos</p></div>
        <div class="periodo"><strong>Período:</strong> ${dataBR(inicio)} a ${dataBR(fim)}</div>
      </header>
      <div class="ficha">
        <div><span>COOPERADO</span><strong>${esc(f.cooperado.nome)}</strong></div>
        <div><span>MATRÍCULA</span><strong>${esc(f.cooperado.matricula || '—')}</strong></div>
        <div><span>CPF</span><strong>${f.cooperado.cpf ? esc(formatarCPF(f.cooperado.cpf)) : '—'}</strong></div>
        <div><span>CLIENTE / PROJETO</span><strong>${esc(cliente)}</strong></div>
        <div><span>ATIVIDADE</span><strong>${esc(f.cooperado.atividade || '—')}</strong></div>
      </div>
      <table>
        <thead><tr><th>Data</th><th>Dia</th><th>Entrada</th><th>Início refeição</th><th>Fim refeição</th><th>Saída</th><th>Rubrica</th></tr></thead>
        <tbody>${f.linhas.map((l) => `
          <tr><td>${dataBR(l.data)}</td><td>${diaSemana(l.data)}</td><td>${l.entrada}</td><td>${l.refeicaoInicio}</td><td>${l.refeicaoFim}</td><td>${l.saida}${l.ajustado ? ' *' : ''}</td><td></td></tr>`).join('')}
        </tbody>
      </table>
      <p class="nota">* Registro ajustado pela Supervisão.</p>
      <div class="assinaturas"><div>Assinatura do Cooperado</div><div>Assinatura do Supervisor Responsável</div></div>
    </section>`).join('');
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8" /><title>Folha de Apontamentos — ${esc(cliente)}</title><style>
    @page { size: A4; margin: 12mm; }
    body { font-family: Arial, sans-serif; color: #0f172a; font-size: 11px; margin: 0; }
    .folha { page-break-after: always; }
    .folha:last-child { page-break-after: auto; }
    header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #4a9e4f; padding-bottom: 6px; margin-bottom: 8px; }
    h1 { font-size: 14px; margin: 0; } header p { margin: 2px 0 0; color: #475569; }
    .ficha { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin-bottom: 8px; }
    .ficha span { display: block; font-size: 9px; color: #64748b; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #cbd5e1; padding: 3px 5px; text-align: center; height: 15px; }
    th { background: #f1f5f9; font-size: 10px; }
    .nota { color: #64748b; font-size: 9px; margin: 4px 0 0; }
    .assinaturas { display: flex; gap: 40px; margin-top: 30px; }
    .assinaturas div { flex: 1; border-top: 1px solid #0f172a; padding-top: 4px; text-align: center; }
  </style></head><body>${paginas}</body></html>`;
}
