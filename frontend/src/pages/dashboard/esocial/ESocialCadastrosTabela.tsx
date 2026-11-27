import { IonButton } from '@ionic/react';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ItemCadastroTabela, SituacaoCadastrosTabela, TipoEventoTabela,
  enviarCadastrosTabelaESocial, listarCadastrosTabelaESocial,
} from '../../../api/esocialApi';
import { BadgeStatus, ListaOcorrencias, PainelProgresso, formatarDataHora, useEnvioESocial } from './esocialComum';
import { useAcessoESocial } from '../../../auth/acessoESocial';

const estiloCard: React.CSSProperties = { background: '#fff', borderRadius: 12, padding: 18, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', marginBottom: 16 };
const estiloTh: React.CSSProperties = { padding: '8px 10px', borderBottom: '1px solid #e0e0e0', textAlign: 'left', fontSize: 12, whiteSpace: 'nowrap' };
const estiloTd: React.CSSProperties = { padding: '8px 10px', borderBottom: '1px solid #f0f0f0', fontSize: 12, verticalAlign: 'top' };

const ORDEM: { tipo: TipoEventoTabela; titulo: string }[] = [
  { tipo: 'S-1000', titulo: 'S-1000 — Empregador' },
  { tipo: 'S-1005', titulo: 'S-1005 — Estabelecimento' },
  { tipo: 'S-1010', titulo: 'S-1010 — Rubricas' },
  { tipo: 'S-1020', titulo: 'S-1020 — Lotação tributária' },
];

/**
 * Cadastros de tabela do eSocial. O S-1000 vai primeiro; depois do aceite, os demais.
 * Só inclusão: alteração de um cadastro já aceito é feita pelo suporte.
 */
const ESocialCadastrosTabela: React.FC = () => {
  const { podeEnviar } = useAcessoESocial();
  const [dados, setDados] = useState<SituacaoCadastrosTabela | null>(null);
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState<TipoEventoTabela | null>(null);

  const carregar = useCallback(() => {
    listarCadastrosTabelaESocial().then((d) => { setDados(d); setErro(''); }).catch((e) => setErro(e.message));
  }, []);
  useEffect(() => { carregar(); }, [carregar]);
  const { progresso, consultarRetornos, limpar } = useEnvioESocial(carregar);

  const enviar = async (tipo: TipoEventoTabela) => {
    setEnviando(tipo);
    setErro('');
    try {
      const r = await enviarCadastrosTabelaESocial(tipo);
      if (!r.recebido) setErro(r.mensagem || 'O eSocial não recebeu o lote.');
      carregar();
      consultarRetornos();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao enviar.');
    } finally {
      setEnviando(null);
    }
  };

  if (!dados) return <div style={estiloCard}>{erro ? <div className="form-erro">{erro}</div> : 'Carregando…'}</div>;

  const pendenciasGerais = [...new Set(dados.itens.flatMap((i) => (i.situacao === 'aceito' ? [] : i.pendencias)))];

  return (
    <div>
      <div style={estiloCard}>
        <p style={{ fontSize: 13, color: '#555', margin: '0 0 8px' }}>
          O eSocial só aceita o cadastro dos cooperados (S-2300) e a folha (S-1200) depois destes cadastros.
          Envie o <strong>S-1000</strong> primeiro; com o aceite, envie S-1005, S-1010 e S-1020.
        </p>
        {pendenciasGerais.length > 0 && (
          <div style={{ background: '#fff8e1', border: '1px solid #f9a825', borderRadius: 8, padding: '10px 12px', fontSize: 12, color: '#7a4b00' }}>
            <strong>Aguardando dados da ATESA (o suporte grava na configuração):</strong>
            <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>{pendenciasGerais.map((p) => <li key={p}>{p}</li>)}</ul>
          </div>
        )}
      </div>

      {erro && <div className="form-erro" style={{ marginBottom: 12 }}>{erro}</div>}
      <PainelProgresso progresso={progresso} onFechar={limpar} />

      <div style={{ ...estiloCard, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr><th style={estiloTh}>Evento</th><th style={estiloTh}>Cadastro</th><th style={estiloTh}>Situação</th><th style={estiloTh}>Retorno / pendências</th><th style={estiloTh} /></tr>
          </thead>
          <tbody>
            {ORDEM.map(({ tipo, titulo }) => {
              const itens = dados.itens.filter((i) => i.tipo === tipo);
              const aEnviar = itens.filter((i) => i.situacao === 'pendente' || i.situacao === 'rejeitado');
              const prontos = aEnviar.filter((i) => !i.pendencias.length);
              const bloqueadoPorS1000 = tipo !== 'S-1000' && !dados.empregadorAceito;
              return itens.map((i, k) => (
                <tr key={i.chave}>
                  {k === 0 && <td style={{ ...estiloTd, fontWeight: 700 }} rowSpan={itens.length}>{titulo}</td>}
                  <td style={estiloTd}>{i.descricao}</td>
                  <td style={estiloTd}><Situacao item={i} /></td>
                  <td style={estiloTd}>
                    {i.situacao !== 'aceito' && i.pendencias.length > 0 && (
                      <ul style={{ margin: 0, paddingLeft: 16, color: '#7a4b00' }}>{i.pendencias.map((p) => <li key={p}>{p}</li>)}</ul>
                    )}
                    {i.situacao === 'aceito' && i.ultimo?.nr_recibo && <span style={{ color: '#2e7d32' }}>Recibo {i.ultimo.nr_recibo}</span>}
                    {i.situacao === 'rejeitado' && <ListaOcorrencias ocorrencias={i.ultimo?.ocorrencias ?? []} descricao={i.ultimo?.desc_resposta} />}
                    {i.ultimo && (
                      <div style={{ color: '#888', marginTop: 4 }}>
                        Último envio {formatarDataHora(i.ultimo.enviado_em)}{i.ultimo.enviado_por_nome ? ` por ${i.ultimo.enviado_por_nome}` : ''} · {i.ultimo.tentativas} tentativa(s)
                      </div>
                    )}
                  </td>
                  {k === 0 && (
                    <td style={{ ...estiloTd, whiteSpace: 'nowrap' }} rowSpan={itens.length}>
                      {podeEnviar && aEnviar.length > 0 && (
                        <IonButton
                          size="small" color="success"
                          disabled={!!enviando || bloqueadoPorS1000 || !prontos.length}
                          title={bloqueadoPorS1000 ? 'Aguarde o aceite do S-1000' : !prontos.length ? 'Faltam dados na configuração' : ''}
                          onClick={() => enviar(tipo)}
                        >
                          {enviando === tipo ? 'Enviando…' : itens.some((x) => x.situacao === 'rejeitado') ? 'Reenviar' : 'Enviar'}
                        </IonButton>
                      )}
                    </td>
                  )}
                </tr>
              ));
            })}
          </tbody>
        </table>
        <div style={{ fontSize: 11, color: '#888', marginTop: 8 }}>
          Depois de aceito, alterações nesses cadastros (S-1000/S-1005/S-1010/S-1020 com “alteração”) são feitas pelo suporte.
        </div>
      </div>
    </div>
  );
};

const Situacao: React.FC<{ item: ItemCadastroTabela }> = ({ item }) => {
  if (item.situacao === 'pendente') return <BadgeStatus status={null} />;
  return <BadgeStatus status={item.ultimo?.status} />;
};

export default ESocialCadastrosTabela;
