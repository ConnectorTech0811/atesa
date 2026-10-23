import React, { useEffect, useState } from 'react';
import './Monitoramento.css';
import { useToast } from '../../../components/ToastContext';
import { ListaMunicipios, Municipio, listarMunicipios, salvarMunicipio } from '../../../api/financeiroApi';
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
  { nome: 'prefeituraEmissora', rotulo: 'Prefeitura emissora', tipo: 'checkbox', placeholder: 'É a prefeitura onde a ATESA (prestador) emite a NFS-e' },
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

  if (!lista) return <div className="monitoramento-table-card" style={{ padding: 24, color: '#94a3b8' }}>Carregando...</div>;
  const outras = lista.municipios.filter((m) => !Number(m.prefeitura_emissora));
  const semAnalise = lista.cidades_clientes_sem_analise.length;

  return (
    <>
      {/* 1. Prefeitura emissora */}
      <div className="monitoramento-table-card">
        <div className="table-card-header">
          <div>
            <h3 className="table-card-title">1. Prefeitura emissora da NFS-e (ATESA)</h3>
            <p style={{ margin: '4px 0 0 0', fontSize: 13, color: '#64748b' }}>
              A nota é emitida na prefeitura onde a ATESA (prestador) está inscrita. É a análise de integração dessa prefeitura que define a emissão automática.
            </p>
          </div>
          {!lista.emissora && (
            <button type="button" className="btn-primary-filter" onClick={() => abrir(null, { prefeituraEmissora: true }, 'Cadastrar a prefeitura emissora')}>+ Informar prefeitura emissora</button>
          )}
        </div>
        {lista.emissora ? (
          <table className="monitoramento-table" style={{ fontSize: 12 }}>
            <thead><tr><th>Município</th><th>Sistema</th><th>Integração avaliada</th><th>Situação</th><th>Pendências</th><th /></tr></thead>
            <tbody>
              <tr>
                <td><strong>{lista.emissora.municipio}/{lista.emissora.uf}</strong>{lista.emissora.codigo_ibge && <div style={{ color: '#64748b' }}>IBGE {lista.emissora.codigo_ibge}</div>}</td>
                <td>{lista.emissora.sistema ?? '—'}{lista.emissora.url && <div><a href={lista.emissora.url} target="_blank" rel="noopener noreferrer">portal</a></div>}</td>
                <td>{MODOS.find((x) => x.valor === lista.emissora!.modo_integracao)?.rotulo}</td>
                <td><Situacao s={lista.emissora.situacao} /></td>
                <td style={{ maxWidth: 320, whiteSpace: 'pre-wrap' }}>{lista.emissora.pendencias ?? '—'}</td>
                <td><button type="button" className="btn-action-edit" onClick={() => abrir(lista.emissora!.id, valores(lista.emissora!))}>Editar</button></td>
              </tr>
            </tbody>
          </table>
        ) : (
          <div style={{ padding: '12px 24px', background: '#fffbeb', color: '#92400e', fontSize: 13 }}>
            ⚠ A prefeitura emissora ainda não foi informada. Confirme com a contabilidade o município de inscrição da ATESA e cadastre-o aqui
            (ou marque uma prefeitura já cadastrada como emissora).
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
              Não é necessário integrar com a prefeitura de cada cliente para emitir a nota.
            </p>
          </div>
          <span className="table-card-count">{lista.cidades_clientes.length} cidade(s) · {semAnalise} sem análise</span>
        </div>
        <div className="table-responsive">
          <table className="monitoramento-table" style={{ fontSize: 12 }}>
            <thead><tr><th>Município</th><th style={{ textAlign: 'right' }}>Clientes</th><th>Análise</th><th /></tr></thead>
            <tbody>
              {lista.cidades_clientes.length === 0 ? (
                <tr><td colSpan={4} style={{ textAlign: 'center', padding: 20, color: '#94a3b8' }}>Nenhum cliente com cidade cadastrada.</td></tr>
              ) : lista.cidades_clientes.map((c) => {
                const m = lista.municipios.find((x) => x.id === c.municipio_id);
                return (
                  <tr key={`${c.municipio}-${c.uf}`}>
                    <td><strong>{c.municipio}/{c.uf}</strong>{m && Number(m.prefeitura_emissora) ? <span style={{ marginLeft: 6, color: '#166534' }}>(emissora)</span> : null}</td>
                    <td style={{ textAlign: 'right' }} title={c.clientes_sem_uf ? `${c.clientes_sem_uf} cliente(s) sem UF no cadastro, agrupado(s) pela cidade` : undefined}>
                      {c.clientes}{c.clientes_sem_uf ? '*' : ''}
                    </td>
                    <td><Situacao s={c.situacao} /></td>
                    <td>{m
                      ? <button type="button" className="btn-action-edit" onClick={() => abrir(m.id, valores(m))}>Editar análise</button>
                      : <button type="button" className="btn-action-view" onClick={() => abrir(null, { municipio: c.municipio, uf: c.uf })}>Registrar análise</button>}
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
              <thead><tr><th>Município</th><th>Sistema</th><th>Integração avaliada</th><th>Situação</th><th>Observações</th><th /></tr></thead>
              <tbody>
                {outras.map((m) => (
                  <tr key={m.id}>
                    <td><strong>{m.municipio}/{m.uf}</strong></td>
                    <td>{m.sistema ?? '—'}</td>
                    <td>{MODOS.find((x) => x.valor === m.modo_integracao)?.rotulo}</td>
                    <td><Situacao s={m.situacao} /></td>
                    <td style={{ maxWidth: 280, whiteSpace: 'pre-wrap' }}>{m.observacoes ?? m.pendencias ?? '—'}</td>
                    <td><button type="button" className="btn-action-edit" onClick={() => abrir(m.id, valores(m))}>Editar</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <p style={{ fontSize: 12, color: '#64748b', margin: '0 4px' }}>Nenhuma integração de emissão está ativa: as notas são emitidas no portal e registradas no processo. Detalhes em docs/nfse-integracao-viabilidade.md.</p>
      {modal && <ModalFormulario {...modal} />}
    </>
  );
};

export default MunicipiosNfse;
