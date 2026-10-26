import React, { useEffect, useState } from 'react';
import './Monitoramento.css';
import { useToast } from '../../../components/ToastContext';
import { ListaMunicipios, Municipio, excluirMunicipio, listarMunicipios, salvarMunicipio } from '../../../api/financeiroApi';
import ModalFormulario, { CampoFormulario, ValoresFormulario } from '../financeiro/ModalFormulario';

const MODOS = [
  { valor: 'nao_analisado', rotulo: 'Não analisado' },
  { valor: 'manual', rotulo: 'Manual (portal da prefeitura)' },
  { valor: 'api_nacional', rotulo: 'API da NFS-e Nacional (Sefin Nacional)' },
  { valor: 'webservice_municipal', rotulo: 'Webservice da prefeitura' },
  { valor: 'rpa', rotulo: 'RPA (automação do portal)' },
];
const SITUACOES = [
  { valor: 'nao_analisado', rotulo: 'Não analisado' },
  { valor: 'em_analise', rotulo: 'Em análise' },
  { valor: 'aguardando_acesso', rotulo: 'Aguardando acessos / homologação' },
  { valor: 'viavel', rotulo: 'Viável (falta implementar e homologar)' },
  { valor: 'inviavel', rotulo: 'Inviável' },
];
const CLASSE_SITUACAO: Record<string, string> = {
  nao_analisado: 'badge-inativo', em_analise: 'badge-pendente', aguardando_acesso: 'badge-pendente', viavel: 'badge-em-atividade', inviavel: 'badge-divergente',
};
const CAMPOS: CampoFormulario[] = [
  { nome: 'municipio', rotulo: 'Município', obrigatorio: true, largura: 'metade' },
  { nome: 'uf', rotulo: 'UF', obrigatorio: true, largura: 'metade' },
  { nome: 'prefeituraEmissora', rotulo: 'Prefeitura emissora', tipo: 'checkbox', placeholder: 'A ATESA (prestador) emite NFS-e nesta prefeitura' },
  { nome: 'codigoIbge', rotulo: 'Código IBGE', largura: 'metade' },
  { nome: 'sistema', rotulo: 'Sistema / emissor', largura: 'metade', placeholder: 'Ex.: Emissor Nacional, Nota Paulistana' },
  { nome: 'url', rotulo: 'Endereço do portal / documentação' },
  { nome: 'modoIntegracao', rotulo: 'Forma de integração avaliada', tipo: 'select', obrigatorio: true, opcoes: MODOS },
  { nome: 'situacao', rotulo: 'Situação da análise', tipo: 'select', obrigatorio: true, opcoes: SITUACOES },
  { nome: 'requisitos', rotulo: 'Requisitos (certificado, login, captcha, homologação...)', tipo: 'textarea' },
  { nome: 'pendencias', rotulo: 'Pendências', tipo: 'textarea', ajuda: 'Exibidas quando alguém tentar a emissão automática.' },
  { nome: 'observacoes', rotulo: 'Observações (ex.: regra de retenção do ISS)', tipo: 'textarea' },
];

const valores = (m: Municipio): ValoresFormulario => ({
  municipio: m.municipio, uf: m.uf, prefeituraEmissora: !!Number(m.prefeitura_emissora), codigoIbge: m.codigo_ibge ?? '', sistema: m.sistema ?? '', url: m.url ?? '',
  modoIntegracao: m.modo_integracao, situacao: m.situacao, requisitos: m.requisitos ?? '', pendencias: m.pendencias ?? '', observacoes: m.observacoes ?? '',
});
const Situacao: React.FC<{ s: string | null }> = ({ s }) => (
  <span className={`badge-status ${CLASSE_SITUACAO[s ?? ''] ?? 'badge-inativo'}`}><span className="badge-status-dot" />{s ? SITUACOES.find((x) => x.valor === s)?.rotulo : 'Sem análise'}</span>
);

export const MunicipiosNfse: React.FC = () => {
  const { showToast } = useToast();
  const [lista, setLista] = useState<ListaMunicipios | null>(null);
  const [modal, setModal] = useState<React.ComponentProps<typeof ModalFormulario> | null>(null);

  const carregar = () => listarMunicipios().then(setLista).catch((e) => showToast(e?.message || 'Erro ao listar prefeituras.', 'error'));
  useEffect(() => { carregar(); }, []);

  const abrir = (id: number | null, iniciais: ValoresFormulario, titulo?: string) => setModal({
    titulo: titulo ?? (id ? 'Editar análise da prefeitura' : 'Cadastrar prefeitura'),
    campos: CAMPOS,
    valoresIniciais: { modoIntegracao: 'nao_analisado', situacao: 'nao_analisado', ...iniciais },
    onConfirmar: async (v) => { await salvarMunicipio(id, v); showToast('Prefeitura salva.', 'success'); await carregar(); },
    onClose: () => setModal(null),
  });

  const excluir = async (m: Municipio, oQue = 'a prefeitura') => {
    if (!window.confirm(`Excluir ${oQue} ${m.municipio}/${m.uf}? A análise registrada será apagada.`)) return;
    try {
      await excluirMunicipio(m.id);
      showToast('Prefeitura excluída.', 'success');
      await carregar();
    } catch (e: any) {
      showToast(e?.message || 'Erro ao excluir.', 'error');
    }
  };
  const Acoes: React.FC<{ m: Municipio; oQue?: string; rotuloEditar?: string }> = ({ m, oQue, rotuloEditar = 'Editar' }) => (
    <div style={{ display: 'inline-flex', gap: 6, whiteSpace: 'nowrap' }}>
      <button type="button" className="btn-action-edit" onClick={() => abrir(m.id, valores(m))}>{rotuloEditar}</button>
      <button type="button" onClick={() => excluir(m, oQue)} title="Excluir"
        style={{ color: '#dc2626', background: 'transparent', border: '1px solid #fecaca', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontWeight: 600, fontSize: 12 }}>
        Excluir
      </button>
    </div>
  );

  if (!lista) return <div className="monitoramento-table-card" style={{ padding: 24, color: '#94a3b8' }}>Carregando...</div>;
  const emissoras = lista.emissoras ?? (lista.emissora ? [lista.emissora] : []);
  const outras = lista.municipios.filter((m) => !Number(m.prefeitura_emissora));
  return (
    <>
      {/* 1. Prefeituras emissoras */}
      <div className="monitoramento-table-card">
        <div className="table-card-header">
          <div>
            <h3 className="table-card-title">1. Prefeituras emissoras da NFS-e (ATESA)</h3>
            <p style={{ margin: '4px 0 0 0', fontSize: 13, color: '#64748b' }}>
              A nota é emitida na prefeitura onde a ATESA (prestador) está inscrita. A análise de integração de cada uma define a emissão automática.
              Na nota, a prefeitura padrão é a emissora da cidade do cliente.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="btn-secondary-filter" onClick={() => abrir(null, { prefeituraEmissora: true }, 'Cadastrar prefeitura emissora')}>+ Prefeitura emissora</button>
          </div>
        </div>
        {emissoras.length > 0 ? (
          <div className="table-responsive">
            <table className="monitoramento-table" style={{ fontSize: 12 }}>
              <thead><tr><th>Município</th><th>Sistema</th><th>Integração avaliada</th><th>Situação</th><th>Pendências</th><th style={{ textAlign: 'center' }}>Ações</th></tr></thead>
              <tbody>
                {emissoras.map((m) => (
                  <tr key={m.id}>
                    <td><strong>{m.municipio}/{m.uf}</strong>{m.codigo_ibge && <div style={{ color: '#64748b' }}>IBGE {m.codigo_ibge}</div>}</td>
                    <td>{m.sistema ?? '—'}{m.url && <div><a href={m.url} target="_blank" rel="noopener noreferrer">portal</a></div>}</td>
                    <td>{MODOS.find((x) => x.valor === m.modo_integracao)?.rotulo}</td>
                    <td><Situacao s={m.situacao} /></td>
                    <td style={{ maxWidth: 360, whiteSpace: 'pre-wrap' }}>{m.pendencias ?? '—'}</td>
                    <td style={{ textAlign: 'center' }}><Acoes m={m} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ padding: '12px 24px', background: '#fffbeb', color: '#92400e', fontSize: 13 }}>
            ⚠ Nenhuma prefeitura emissora cadastrada. Use "+ Prefeitura emissora" ou marque uma prefeitura já cadastrada como emissora.
          </div>
        )}
      </div>

      {/* 2. Cidades dos clientes */}
      <div className="monitoramento-table-card">
        <div className="table-card-header">
          <div>
            <h3 className="table-card-title">2. Cidades dos clientes</h3>
            <p style={{ margin: '4px 0 0 0', fontSize: 13, color: '#64748b' }}>
              Referência para retenção e local de incidência do ISS, conforme o serviço prestado (confirmar com a contabilidade).
              Só as cidades em que a ATESA emite NFS-e precisam de análise de integração; nas demais não é preciso integrar com a prefeitura.
            </p>
          </div>
          <span className="table-card-count">{lista.cidades_clientes.length} cidade(s) · {lista.cidades_clientes_sem_analise.length} sem análise</span>
        </div>
        <div className="table-responsive">
          <table className="monitoramento-table" style={{ fontSize: 12 }}>
            <thead><tr><th>Município</th><th style={{ textAlign: 'right' }}>Clientes</th><th>Emissão pela ATESA</th><th>Análise</th><th style={{ textAlign: 'center' }}>Ações</th></tr></thead>
            <tbody>
              {lista.cidades_clientes.length === 0 ? (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: 20, color: '#94a3b8' }}>Nenhum cliente com cidade cadastrada.</td></tr>
              ) : lista.cidades_clientes.map((c) => {
                const m = lista.municipios.find((x) => x.id === c.municipio_id);
                const ehEmissora = !!m && !!Number(m.prefeitura_emissora);
                return (
                  <tr key={`${c.municipio}-${c.uf}`}>
                    <td><strong>{c.municipio}/{c.uf}</strong></td>
                    <td style={{ textAlign: 'right' }} title={c.clientes_sem_uf ? `${c.clientes_sem_uf} cliente(s) sem UF no cadastro, agrupado(s) pela cidade` : undefined}>
                      {c.clientes}{c.clientes_sem_uf ? '*' : ''}
                    </td>
                    <td>
                      {ehEmissora
                        ? <span className="badge-status badge-em-atividade"><span className="badge-status-dot" />Emite NFS-e aqui</span>
                        : <span style={{ color: '#64748b' }}>Não emite — só referência de ISS</span>}
                    </td>
                    <td>{m ? <Situacao s={c.situacao} /> : <span style={{ color: '#94a3b8' }}>Não se aplica</span>}</td>
                    <td style={{ textAlign: 'center' }}>
                      {m ? <Acoes m={m} oQue="a análise de" /> : (
                        <div style={{ display: 'inline-flex', gap: 6, whiteSpace: 'nowrap' }}>
                          <button type="button" className="btn-action-edit" onClick={() => abrir(null, { municipio: c.municipio, uf: c.uf }, 'Registrar análise da prefeitura')}>Editar</button>
                          <button type="button" disabled title="Sem análise registrada para excluir"
                            style={{ color: '#cbd5e1', background: 'transparent', border: '1px solid #e2e8f0', borderRadius: 6, padding: '4px 10px', fontWeight: 600, fontSize: 12, cursor: 'not-allowed' }}>
                            Excluir
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {(lista.cidades_clientes.some((c) => c.clientes_sem_uf) || lista.clientes_sem_uf.length > 0 || lista.clientes_sem_cidade > 0) && (
          <div style={{ padding: '8px 24px', fontSize: 12, color: '#64748b' }}>
            {lista.cidades_clientes.some((c) => c.clientes_sem_uf) && <div>* Inclui cliente(s) sem UF no cadastro, agrupado(s) pela cidade de mesmo nome.</div>}
            {lista.clientes_sem_uf.map((c) => <div key={c.municipio}>{c.municipio}: {c.clientes} cliente(s) sem UF e cidade ambígua — corrija no cadastro de empresas.</div>)}
            {lista.clientes_sem_cidade > 0 && <div>{lista.clientes_sem_cidade} cliente(s) sem cidade no cadastro de empresas.</div>}
          </div>
        )}
      </div>

      {/* 3. Outras prefeituras analisadas */}
      {outras.length > 0 && (
        <div className="monitoramento-table-card">
          <div className="table-card-header">
            <h3 className="table-card-title">3. Prefeituras analisadas</h3>
            <button type="button" className="btn-secondary-filter" onClick={() => abrir(null, {})}>+ Prefeitura</button>
          </div>
          <div className="table-responsive">
            <table className="monitoramento-table" style={{ fontSize: 12 }}>
              <thead><tr><th>Município</th><th>Sistema</th><th>Integração avaliada</th><th>Situação</th><th>Observações</th><th style={{ textAlign: 'center' }}>Ações</th></tr></thead>
              <tbody>
                {outras.map((m) => (
                  <tr key={m.id}>
                    <td><strong>{m.municipio}/{m.uf}</strong></td>
                    <td>{m.sistema ?? '—'}</td>
                    <td>{MODOS.find((x) => x.valor === m.modo_integracao)?.rotulo}</td>
                    <td><Situacao s={m.situacao} /></td>
                    <td style={{ maxWidth: 280, whiteSpace: 'pre-wrap' }}>{m.observacoes ?? m.pendencias ?? '—'}</td>
                    <td style={{ textAlign: 'center' }}><Acoes m={m} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <p style={{ fontSize: 12, color: '#64748b', margin: '0 4px' }}>Nenhuma integração de emissão está ativa: as notas são emitidas no portal e registradas no processo. A análise das emissoras foi pesquisada em 24/10/2026 e deve ser confirmada com cada prefeitura e com a contabilidade. Detalhes em docs/nfse-integracao-viabilidade.md.</p>
      {modal && <ModalFormulario {...modal} />}
    </>
  );
};

export default MunicipiosNfse;
