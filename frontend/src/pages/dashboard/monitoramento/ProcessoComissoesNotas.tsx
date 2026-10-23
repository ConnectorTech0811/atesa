import React, { useEffect, useState } from 'react';
import './Monitoramento.css';
import { useToast } from '../../../components/ToastContext';
import { formatarDataBR, formatarMoeda } from '../../../utils/formatters';
import {
  Cobranca, Comissao, Municipio, NotaFiscal, OpcoesComissao, ResponsaveisProcesso,
  adicionarResponsavel, anexarDocumentoNota, atualizarCobranca, atualizarNota, baixarDocumentoFinanceiro, calcularComissoes,
  cancelarCobranca, cancelarNota, conferirComissao, contestarComissao, criarCobranca, criarNota, emitirNotaAutomaticamente,
  informarBaseManualComissao, listarCobrancasProcesso, listarComissoes, listarMunicipios, listarNotas, listarResponsaveis,
  obterOpcoesComissao, reabrirComissao, registrarEmissaoNota, removerResponsavel, vincularResponsaveisDaEmpresa,
} from '../../../api/financeiroApi';
import ModalFormulario, { CampoFormulario, ValoresFormulario } from '../financeiro/ModalFormulario';

const ROTULO_SITUACAO_COMISSAO: Record<string, string> = {
  aguardando_regra: 'Aguardando regra',
  aguardando_base: 'Aguardando base',
  calculada: 'Calculada',
  conferida: 'Conferida',
  contestada: 'Contestada',
};
const CLASSE: Record<string, string> = {
  aguardando_regra: 'badge-inativo', aguardando_base: 'badge-pendente', calculada: 'badge-ativo', conferida: 'badge-em-atividade', contestada: 'badge-divergente',
  rascunho: 'badge-pendente', emitida: 'badge-em-atividade', cancelada: 'badge-inativo',
  aberta: 'badge-ativo', parcial: 'badge-pendente', paga: 'badge-em-atividade', divergente: 'badge-divergente',
};
const ROTULO_STATUS: Record<string, string> = {
  rascunho: 'Rascunho', emitida: 'Emitida', cancelada: 'Cancelada', aberta: 'Aberta', parcial: 'Paga parcialmente', paga: 'Paga', divergente: 'Recebido a maior',
};
const FORMAS = [
  { valor: 'boleto', rotulo: 'Boleto' }, { valor: 'pix', rotulo: 'PIX' }, { valor: 'transferencia', rotulo: 'Transferência' },
  { valor: 'deposito', rotulo: 'Depósito' }, { valor: 'outro', rotulo: 'Outro' },
];

const Badge: React.FC<{ s: string; rotulo?: string }> = ({ s, rotulo }) => (
  <span className={`badge-status ${CLASSE[s] ?? 'badge-inativo'}`}><span className="badge-status-dot" />{rotulo ?? ROTULO_STATUS[s] ?? ROTULO_SITUACAO_COMISSAO[s] ?? s}</span>
);
const moeda = (v: string | number | null) => (v === null || v === undefined ? '—' : formatarMoeda(Number(v)));
const dec = (v: string | null | undefined) => (v === null || v === undefined || v === '' ? '' : String(Number(v)).replace('.', ','));

const CAMPOS_NOTA = (municipios: Municipio[]): CampoFormulario[] => [
  { nome: 'municipioId', rotulo: 'Prefeitura emissora', tipo: 'select', opcoes: municipios.map((m) => ({ valor: m.id, rotulo: `${m.municipio}/${m.uf}${Number(m.prefeitura_emissora) ? ' (emissora da ATESA)' : ''}` })), ajuda: 'Informe a prefeitura emissora na aba "Prefeituras (NFS-e)".' },
  { nome: 'serie', rotulo: 'Série', largura: 'metade' },
  { nome: 'codigoServico', rotulo: 'Código do serviço (LC 116)', largura: 'metade' },
  { nome: 'prestadorNome', rotulo: 'Prestador', largura: 'metade' },
  { nome: 'prestadorCnpj', rotulo: 'CNPJ do prestador', largura: 'metade' },
  { nome: 'tomadorNome', rotulo: 'Tomador', largura: 'metade' },
  { nome: 'tomadorDocumento', rotulo: 'CNPJ/CPF do tomador', largura: 'metade' },
  { nome: 'tomadorEndereco', rotulo: 'Endereço do tomador' },
  { nome: 'tomadorMunicipio', rotulo: 'Município do tomador', largura: 'metade' },
  { nome: 'tomadorUf', rotulo: 'UF', largura: 'metade' },
  { nome: 'discriminacao', rotulo: 'Discriminação dos serviços', tipo: 'textarea' },
  { nome: 'valorServicos', rotulo: 'Valor dos serviços', tipo: 'numero', largura: 'metade' },
  { nome: 'valorDeducoes', rotulo: 'Deduções', tipo: 'numero', largura: 'metade' },
  { nome: 'aliquotaIss', rotulo: 'Alíquota ISS (%)', tipo: 'numero', largura: 'metade' },
  { nome: 'valorIss', rotulo: 'Valor do ISS', tipo: 'numero', largura: 'metade' },
  { nome: 'issRetido', rotulo: 'ISS retido pelo tomador', tipo: 'checkbox' },
  { nome: 'valorPis', rotulo: 'PIS retido', tipo: 'numero', largura: 'metade' },
  { nome: 'valorCofins', rotulo: 'COFINS retido', tipo: 'numero', largura: 'metade' },
  { nome: 'valorCsll', rotulo: 'CSLL retido', tipo: 'numero', largura: 'metade' },
  { nome: 'valorIrrf', rotulo: 'IRRF retido', tipo: 'numero', largura: 'metade' },
  { nome: 'valorInss', rotulo: 'INSS retido', tipo: 'numero', largura: 'metade' },
  { nome: 'outrasRetencoes', rotulo: 'Outras retenções', tipo: 'numero', largura: 'metade' },
  { nome: 'valorLiquido', rotulo: 'Valor líquido (como consta na nota)', tipo: 'numero' },
];

const valoresNota = (n: NotaFiscal): ValoresFormulario => ({
  municipioId: n.municipio_id ?? '', serie: n.serie ?? '', codigoServico: n.codigo_servico ?? '', prestadorNome: n.prestador_nome ?? '',
  prestadorCnpj: n.prestador_cnpj ?? '', tomadorNome: n.tomador_nome ?? '', tomadorDocumento: n.tomador_documento ?? '',
  tomadorEndereco: n.tomador_endereco ?? '', tomadorMunicipio: n.tomador_municipio ?? '', tomadorUf: n.tomador_uf ?? '',
  discriminacao: n.discriminacao ?? '', valorServicos: dec(n.valor_servicos), valorDeducoes: dec(n.valor_deducoes), aliquotaIss: dec(n.aliquota_iss),
  valorIss: dec(n.valor_iss), issRetido: !!n.iss_retido, valorPis: dec(n.valor_pis), valorCofins: dec(n.valor_cofins), valorCsll: dec(n.valor_csll),
  valorIrrf: dec(n.valor_irrf), valorInss: dec(n.valor_inss), outrasRetencoes: dec(n.outras_retencoes), valorLiquido: dec(n.valor_liquido),
});

interface Props {
  processo: { id: number; codigo: string; status: string; competencia: string; vencimento?: string | null };
}

export const ProcessoComissoesNotas: React.FC<Props> = ({ processo }) => {
  const { showToast } = useToast();
  const [resp, setResp] = useState<ResponsaveisProcesso | null>(null);
  const [comissoes, setComissoes] = useState<Comissao[]>([]);
  const [notas, setNotas] = useState<NotaFiscal[]>([]);
  const [cobrancas, setCobrancas] = useState<Cobranca[]>([]);
  const [municipios, setMunicipios] = useState<Municipio[]>([]);
  const [emissoraId, setEmissoraId] = useState<number | ''>('');
  const [opcoes, setOpcoes] = useState<OpcoesComissao | null>(null);
  const [modal, setModal] = useState<React.ComponentProps<typeof ModalFormulario> | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const aprovado = processo.status === 'aprovado';

  const carregar = async () => {
    try {
      const [r, c] = await Promise.all([listarResponsaveis(processo.id), listarComissoes({ processoId: processo.id })]);
      setResp(r);
      setComissoes(c);
      if (aprovado) {
        const [n, cb, m] = await Promise.all([listarNotas(processo.id), listarCobrancasProcesso(processo.id), listarMunicipios()]);
        setNotas(n);
        setCobrancas(cb);
        setMunicipios(m.municipios);
        setEmissoraId(m.emissora?.id ?? '');
      }
    } catch (err: any) {
      showToast(err?.message || 'Erro ao carregar comissões e notas.', 'error');
    }
  };

  useEffect(() => { carregar(); }, [processo.id, processo.status]);
  useEffect(() => { obterOpcoesComissao().then(setOpcoes).catch(() => setOpcoes(null)); }, []);

  const executar = async (acao: () => Promise<unknown>, sucesso: string) => {
    setOcupado(true);
    try { await acao(); showToast(sucesso, 'success'); await carregar(); }
    catch (err: any) { showToast(err?.message || 'Não foi possível concluir a ação.', 'error'); }
    finally { setOcupado(false); }
  };
  const abrir = (cfg: Omit<React.ComponentProps<typeof ModalFormulario>, 'onClose' | 'onConfirmar'> & { onConfirmar: (v: ValoresFormulario) => Promise<unknown>; sucesso: string }) =>
    setModal({ ...cfg, onConfirmar: async (v) => { await cfg.onConfirmar(v); showToast(cfg.sucesso, 'success'); await carregar(); }, onClose: () => setModal(null) });
  const pedirMotivo = (titulo: string, rotulo: string, acao: (motivo: string) => Promise<unknown>, sucesso: string, descricao?: string) =>
    abrir({ titulo, descricao, campos: [{ nome: 'motivo', rotulo, tipo: 'textarea', obrigatorio: true }], onConfirmar: (v) => acao(v.motivo), sucesso });

  const notasEmitidas = notas.filter((n) => n.status === 'emitida');
  const totalNotas = notasEmitidas.reduce((s, n) => s + Number(n.valor_servicos), 0);
  const totalCobrancas = cobrancas.filter((c) => c.status !== 'cancelada').reduce((s, c) => s + Number(c.valor), 0);

  const camposCobranca: CampoFormulario[] = [
    { nome: 'notaId', rotulo: 'Nota fiscal', tipo: 'select', opcoes: notasEmitidas.map((n) => ({ valor: n.id, rotulo: `Nº ${n.numero} — ${moeda(n.valor_servicos)}` })) },
    { nome: 'valor', rotulo: 'Valor', tipo: 'numero', obrigatorio: true, largura: 'metade' },
    { nome: 'vencimento', rotulo: 'Vencimento', tipo: 'data', obrigatorio: true, largura: 'metade', ajuda: processo.vencimento ? `Ficha da unidade: vencimento "${processo.vencimento}".` : undefined },
    { nome: 'forma', rotulo: 'Forma', tipo: 'select', obrigatorio: true, opcoes: FORMAS, largura: 'metade' },
    { nome: 'bancoCodigo', rotulo: 'Banco (código)', placeholder: 'Ex: 341', largura: 'metade' },
    { nome: 'nossoNumero', rotulo: 'Nosso número', largura: 'metade', ajuda: 'Usado para casar o pagamento no retorno bancário.' },
    { nome: 'linhaDigitavel', rotulo: 'Linha digitável', largura: 'metade' },
    { nome: 'observacao', rotulo: 'Observação', tipo: 'textarea' },
  ];

  return (
    <div style={{ borderTop: '2px solid #e2e8f0' }}>
      {/* ── Responsáveis e comissões ── */}
      <div style={{ padding: '14px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <h4 style={{ margin: 0 }}>Responsáveis e comissões</h4>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="btn-secondary-filter" disabled={ocupado} onClick={() => executar(async () => {
              const r = await vincularResponsaveisDaEmpresa(processo.id);
              r.avisos.forEach((a) => showToast(a, 'warning'));
            }, 'Responsáveis do cadastro da empresa vinculados.')}>Vincular do cadastro da empresa</button>
            <button type="button" className="btn-secondary-filter" disabled={ocupado || !opcoes} onClick={() => abrir({
              titulo: 'Adicionar responsável',
              campos: [
                { nome: 'papel', rotulo: 'Papel', tipo: 'select', obrigatorio: true, opcoes: [{ valor: 'consultor', rotulo: 'Consultor' }, { valor: 'executivo', rotulo: 'Executivo de contas' }] },
                { nome: 'usuarioId', rotulo: 'Usuário', tipo: 'select', obrigatorio: true, opcoes: (opcoes?.usuarios ?? []).map((u) => ({ valor: u.id, rotulo: `${u.nome} (${u.tipo_usuario})` })) },
              ],
              valoresIniciais: { papel: 'consultor', usuarioId: opcoes?.usuarios[0]?.id ?? '' },
              onConfirmar: (v) => adicionarResponsavel(processo.id, v.papel, Number(v.usuarioId)),
              sucesso: 'Responsável vinculado.',
            })}>+ Responsável</button>
            {aprovado && (
              <button type="button" className="btn-primary-filter" disabled={ocupado} onClick={() => executar(async () => {
                const r = await calcularComissoes(processo.id);
                if (r.conferidas_alteradas) showToast(`${r.conferidas_alteradas} comissão(ões) conferida(s) mudaram e voltaram para conferência.`, 'warning');
              }, 'Comissões calculadas.')}>Calcular comissões</button>
            )}
          </div>
        </div>
        {resp?.avisos.length ? <div style={{ fontSize: 12, color: '#92400e', marginTop: 6 }}>⚠ {resp.avisos.join(' ')}</div> : null}
        {!aprovado && <p style={{ fontSize: 12, color: '#64748b' }}>As comissões são calculadas depois que a apuração for aprovada.</p>}
        <table className="monitoramento-table" style={{ fontSize: 12, marginTop: 8 }}>
          <thead><tr><th>Responsável</th><th>Papel</th><th>Origem</th><th>Regra</th><th style={{ textAlign: 'right' }}>Base</th><th style={{ textAlign: 'right' }}>%</th><th style={{ textAlign: 'right' }}>Comissão</th><th>Situação</th><th /></tr></thead>
          <tbody>
            {(resp?.responsaveis ?? []).length === 0 ? (
              <tr><td colSpan={9} style={{ textAlign: 'center', padding: 16, color: '#94a3b8' }}>Nenhum responsável vinculado.</td></tr>
            ) : resp!.responsaveis.map((r) => {
              const c = comissoes.find((x) => x.responsavel_id === r.id);
              return (
                <tr key={r.id}>
                  <td><strong>{r.usuario_nome}</strong></td>
                  <td>{r.papel === 'consultor' ? 'Consultor' : 'Executivo'}</td>
                  <td>{r.origem === 'empresa' ? 'Cadastro da empresa' : 'Manual'}</td>
                  <td title={c?.confirmacao_referencia ?? undefined}>{c?.regra_id ? `#${c.regra_id}${c.base_calculo ? ` · ${opcoes?.bases[c.base_calculo] ?? c.base_calculo}` : ''}` : '—'}</td>
                  <td style={{ textAlign: 'right' }} title={c?.base_manual_motivo ?? undefined}>{c ? moeda(c.base_valor) : '—'}</td>
                  <td style={{ textAlign: 'right' }}>{c?.percentual ? Number(c.percentual).toLocaleString('pt-BR') : '—'}</td>
                  <td style={{ textAlign: 'right' }}><strong>{c ? moeda(c.valor) : '—'}</strong></td>
                  <td>{c ? <><Badge s={c.situacao} />{c.motivo_situacao && <div style={{ color: '#64748b', maxWidth: 260 }}>{c.motivo_situacao}</div>}</> : '—'}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {c?.situacao === 'calculada' && <button type="button" className="btn-action-view" disabled={ocupado} onClick={() => executar(() => conferirComissao(c.id), 'Comissão conferida.')}>Conferir</button>}{' '}
                    {c && ['calculada', 'conferida'].includes(c.situacao) && <button type="button" className="btn-action-obs" disabled={ocupado} onClick={() => pedirMotivo('Contestar comissão', 'Motivo', (m) => contestarComissao(c.id, m), 'Comissão contestada.')}>Contestar</button>}
                    {c?.situacao === 'contestada' && <button type="button" className="btn-action-edit" disabled={ocupado} onClick={() => pedirMotivo('Reabrir comissão', 'Motivo', (m) => reabrirComissao(c.id, m), 'Comissão reaberta.')}>Reabrir</button>}{' '}
                    {c?.base_calculo === 'manual' && c.situacao !== 'conferida' && <button type="button" className="btn-action-edit" disabled={ocupado} onClick={() => abrir({
                      titulo: `Base manual — ${r.usuario_nome}`,
                      descricao: 'A regra confirmada desta comissão usa base informada manualmente.',
                      campos: [{ nome: 'valor', rotulo: 'Base de cálculo (R$)', tipo: 'numero', obrigatorio: true }, { nome: 'motivo', rotulo: 'Origem / motivo', tipo: 'textarea', obrigatorio: true }],
                      valoresIniciais: { valor: dec(c.base_valor) },
                      onConfirmar: (v) => informarBaseManualComissao(c.id, v.valor, v.motivo),
                      sucesso: 'Base informada.',
                    })}>Base</button>}{' '}
                    {c?.situacao !== 'conferida' && <button type="button" className="btn-action-obs" disabled={ocupado} onClick={() => pedirMotivo(`Remover ${r.usuario_nome}`, 'Motivo da remoção', (m) => removerResponsavel(processo.id, r.id, m), 'Responsável removido.')}>Remover</button>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {aprovado && (
        <>
          {/* ── Notas fiscais ── */}
          <div style={{ padding: '14px 24px', borderTop: '1px solid #f1f5f9' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
              <h4 style={{ margin: 0 }}>Notas fiscais (NFS-e)</h4>
              <button type="button" className="btn-secondary-filter" disabled={ocupado} onClick={() => abrir({
                titulo: 'Nova nota fiscal (rascunho)',
                descricao: 'Tomador e prestador vêm dos cadastros e podem ser ajustados. Os valores fiscais (ISS, retenções, líquido) são informados como constarão na nota: o sistema não calcula tributos.',
                campos: CAMPOS_NOTA(municipios),
                valoresIniciais: { municipioId: emissoraId },
                onConfirmar: (v) => criarNota(processo.id, v),
                sucesso: 'Rascunho da nota criado.',
              })}>+ Nova nota</button>
            </div>
            <table className="monitoramento-table" style={{ fontSize: 12, marginTop: 8 }}>
              <thead><tr><th>Número</th><th>Prefeitura</th><th>Emissão</th><th style={{ textAlign: 'right' }}>Serviços</th><th style={{ textAlign: 'right' }}>ISS</th><th style={{ textAlign: 'right' }}>Líquido</th><th>Status</th><th>Documentos</th><th /></tr></thead>
              <tbody>
                {notas.length === 0 ? (
                  <tr><td colSpan={9} style={{ textAlign: 'center', padding: 16, color: '#94a3b8' }}>Nenhuma nota registrada.</td></tr>
                ) : notas.map((n) => (
                  <tr key={n.id}>
                    <td><strong>{n.numero ? `${n.numero}${n.serie ? `/${n.serie}` : ''}` : '—'}</strong>{n.codigo_verificacao && <div style={{ color: '#64748b' }}>Verif.: {n.codigo_verificacao}</div>}</td>
                    <td>{n.municipio_emissor ? `${n.municipio_emissor}/${n.uf_emissor}` : '—'}</td>
                    <td>{n.data_emissao ? formatarDataBR(n.data_emissao) : '—'}</td>
                    <td style={{ textAlign: 'right' }}>{moeda(n.valor_servicos)}</td>
                    <td style={{ textAlign: 'right' }}>{moeda(n.valor_iss)}{n.iss_retido ? ' (retido)' : ''}</td>
                    <td style={{ textAlign: 'right' }}>{moeda(n.valor_liquido)}</td>
                    <td><Badge s={n.status} />{n.motivo_cancelamento && <div style={{ color: '#64748b' }}>{n.motivo_cancelamento}</div>}</td>
                    <td>{n.documentos.map((d) => (
                      <div key={d.id}><button type="button" style={{ border: 'none', background: 'none', color: '#2563eb', cursor: 'pointer', padding: 0 }}
                        onClick={() => baixarDocumentoFinanceiro(d.id, d.nome_arquivo).catch((e) => showToast(e?.message || 'Erro ao baixar.', 'error'))}>⬇ {d.nome_arquivo}</button></div>
                    ))}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {n.status === 'rascunho' && (
                        <>
                          <button type="button" className="btn-action-edit" disabled={ocupado} onClick={() => abrir({
                            titulo: 'Editar rascunho da nota', campos: CAMPOS_NOTA(municipios), valoresIniciais: valoresNota(n),
                            onConfirmar: (v) => atualizarNota(n.id, v), sucesso: 'Nota atualizada.',
                          })}>Editar</button>{' '}
                          <button type="button" className="btn-action-view" disabled={ocupado} onClick={() => abrir({
                            titulo: 'Registrar nota emitida no portal da prefeitura',
                            descricao: 'Informe os dados da NFS-e emitida no portal da prefeitura. O sistema não emite a nota.',
                            campos: [
                              { nome: 'numero', rotulo: 'Número da NFS-e', obrigatorio: true, largura: 'metade' },
                              { nome: 'serie', rotulo: 'Série', largura: 'metade' },
                              { nome: 'dataEmissao', rotulo: 'Data de emissão', tipo: 'data', obrigatorio: true, largura: 'metade' },
                              { nome: 'codigoVerificacao', rotulo: 'Código de verificação', largura: 'metade' },
                            ],
                            valoresIniciais: { serie: n.serie ?? '' },
                            onConfirmar: (v) => registrarEmissaoNota(n.id, v as any), sucesso: 'Emissão registrada.',
                          })}>Registrar emissão</button>{' '}
                          <button type="button" className="btn-action-obs" disabled={ocupado} title="Integração com a prefeitura ainda não disponível"
                            onClick={() => emitirNotaAutomaticamente(n.id).catch((e) => showToast(e?.message || 'Emissão automática indisponível.', 'warning'))}>Emitir automaticamente</button>{' '}
                        </>
                      )}
                      {n.status !== 'cancelada' && (
                        <>
                          <button type="button" className="btn-action-edit" disabled={ocupado} onClick={() => abrir({
                            titulo: 'Anexar PDF ou XML da nota',
                            campos: [
                              { nome: 'tipo', rotulo: 'Tipo', tipo: 'select', obrigatorio: true, opcoes: [{ valor: 'pdf', rotulo: 'PDF (DANFSe)' }, { valor: 'xml', rotulo: 'XML' }] },
                              { nome: 'arquivo', rotulo: 'Arquivo (até 3 MB)', tipo: 'arquivo', obrigatorio: true, aceitar: '.pdf,.xml' },
                            ],
                            valoresIniciais: { tipo: 'pdf' },
                            onConfirmar: (v) => anexarDocumentoNota(n.id, v.tipo, v.arquivo), sucesso: 'Documento anexado.',
                          })}>Anexar</button>{' '}
                          <button type="button" className="btn-action-obs" disabled={ocupado} onClick={() => pedirMotivo('Cancelar nota', 'Motivo do cancelamento', (m) => cancelarNota(n.id, m), 'Nota cancelada.',
                            n.status === 'emitida' ? 'Isto registra o cancelamento no sistema. O cancelamento da NFS-e na prefeitura deve ser feito no portal.' : undefined)}>Cancelar</button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ── Cobranças ── */}
          <div style={{ padding: '14px 24px', borderTop: '1px solid #f1f5f9' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
              <h4 style={{ margin: 0 }}>Cobranças</h4>
              <button type="button" className="btn-secondary-filter" disabled={ocupado} onClick={() => abrir({
                titulo: 'Registrar cobrança', campos: camposCobranca, valoresIniciais: { forma: 'boleto', notaId: notasEmitidas[0]?.id ?? '' },
                onConfirmar: (v) => criarCobranca(processo.id, v), sucesso: 'Cobrança registrada.',
              })}>+ Nova cobrança</button>
            </div>
            {notasEmitidas.length > 0 && Math.abs(totalNotas - totalCobrancas) > 0.004 && (
              <div style={{ fontSize: 12, color: '#92400e', marginTop: 6 }}>
                Notas emitidas: {moeda(totalNotas)} · cobranças ativas: {moeda(totalCobrancas)} (a regra entre valor da nota, líquido e cobrança ainda não foi definida; confira).
              </div>
            )}
            <table className="monitoramento-table" style={{ fontSize: 12, marginTop: 8 }}>
              <thead><tr><th>Código</th><th>NF</th><th>Vencimento</th><th>Forma</th><th>Nosso número</th><th style={{ textAlign: 'right' }}>Valor</th><th style={{ textAlign: 'right' }}>Recebido</th><th>Status</th><th /></tr></thead>
              <tbody>
                {cobrancas.length === 0 ? (
                  <tr><td colSpan={9} style={{ textAlign: 'center', padding: 16, color: '#94a3b8' }}>Nenhuma cobrança registrada.</td></tr>
                ) : cobrancas.map((c) => (
                  <tr key={c.id}>
                    <td><strong>{c.codigo}</strong></td>
                    <td>{c.nota_numero ?? '—'}</td>
                    <td style={{ color: c.vencida ? '#b91c1c' : undefined }}>{formatarDataBR(c.vencimento)}{c.vencida ? ' (vencida)' : ''}</td>
                    <td>{FORMAS.find((f) => f.valor === c.forma)?.rotulo}</td>
                    <td>{c.nosso_numero ? `${c.banco_codigo ?? ''} ${c.nosso_numero}` : '—'}</td>
                    <td style={{ textAlign: 'right' }}>{moeda(c.valor)}</td>
                    <td style={{ textAlign: 'right' }}>{moeda(c.valor_recebido)}</td>
                    <td><Badge s={c.status} /></td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {c.status === 'aberta' && Number(c.valor_recebido) === 0 && (
                        <>
                          <button type="button" className="btn-action-edit" disabled={ocupado} onClick={() => abrir({
                            titulo: `Editar ${c.codigo}`, campos: camposCobranca,
                            valoresIniciais: { notaId: c.nota_id ?? '', valor: dec(c.valor), vencimento: c.vencimento.slice(0, 10), forma: c.forma, bancoCodigo: c.banco_codigo ?? '', nossoNumero: c.nosso_numero ?? '', linhaDigitavel: c.linha_digitavel ?? '', observacao: c.observacao ?? '' },
                            onConfirmar: (v) => atualizarCobranca(c.id, v), sucesso: 'Cobrança atualizada.',
                          })}>Editar</button>{' '}
                          <button type="button" className="btn-action-obs" disabled={ocupado} onClick={() => pedirMotivo(`Cancelar ${c.codigo}`, 'Motivo', (m) => cancelarCobranca(c.id, m), 'Cobrança cancelada.')}>Cancelar</button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p style={{ fontSize: 12, color: '#64748b', margin: '6px 0 0' }}>Recebimentos e baixas são feitos pelo Financeiro (menu Financeiro).</p>
          </div>
        </>
      )}

      {modal && <ModalFormulario {...modal} />}
    </div>
  );
};

export default ProcessoComissoesNotas;
