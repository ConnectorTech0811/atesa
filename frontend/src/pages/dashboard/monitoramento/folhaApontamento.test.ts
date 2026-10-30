import { describe, expect, it } from 'vitest';
import { ApontamentoDetalhado } from '../../../api/monitoramentoApi';
import { htmlFolhas, montarFolhas } from './folhaApontamento';

const ap = (id: number, candidato_id: number, tipo_evento: string, ts: string, extra = {}) => ({
  id, candidato_id, tipo_evento, timestamp_dispositivo: ts, data_referencia: ts.slice(0, 10), ajustado: 0, candidato_nome: `Coop ${candidato_id}`, ...extra,
}) as unknown as ApontamentoDetalhado;

describe('folha de apontamentos', () => {
  const coops = [{ id: 1, nome: 'Bruna', matricula: '10' }, { id: 2, nome: 'Ana <script>', matricula: '11' }];
  const batidas = [ap(1, 1, 'jornada_inicio', '2026-10-01 19:00:00'), ap(2, 1, 'jornada_fim', '2026-10-02 07:00:00', { ajustado: 1 })];

  it('gera uma folha por cooperado, inclusive sem batidas, com todos os dias', () => {
    const f = montarFolhas(coops, batidas, '2026-10-01', '2026-10-03');
    expect(f.map((x) => x.cooperado.nome)).toEqual(['Ana <script>', 'Bruna']);
    expect(f[0].diasComRegistro).toBe(0);
    expect(f[0].linhas).toHaveLength(3);
    expect(f[1].linhas[0]).toMatchObject({ data: '2026-10-01', entrada: '19:00', saida: '07:00', ajustado: true });
    expect(f[1].linhas[1].entrada).toBe('');
  });

  it('inclui quem bateu ponto no cliente mesmo sem alocação ativa', () => {
    const f = montarFolhas([coops[0]], [...batidas, ap(3, 9, 'jornada_inicio', '2026-10-02 08:00:00')], '2026-10-01', '2026-10-03');
    expect(f.map((x) => x.cooperado.id)).toEqual([1, 9]);
  });

  it('escapa os dados no documento de impressão', () => {
    const html = htmlFolhas(montarFolhas(coops, [], '2026-10-01', '2026-10-01'), { cliente: 'X & Y', inicio: '2026-10-01', fim: '2026-10-01' });
    expect(html).toContain('Ana &lt;script&gt;');
    expect(html).toContain('X &amp; Y');
    expect(html).not.toContain('<script>');
    expect(html.match(/class="folha"/g)).toHaveLength(2);
  });
});
