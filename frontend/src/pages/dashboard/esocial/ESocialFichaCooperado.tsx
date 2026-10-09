import { IonButton } from '@ionic/react';
import React, { useCallback, useEffect, useState } from 'react';
import { TentativaESocial, marcarCadastrosExistentes, obterHistoricoESocial } from '../../../api/esocialApi';
import { useAcessoESocial } from '../../../auth/acessoESocial';
import { BadgeStatus, ListaOcorrencias, PainelProgresso, TabelaTentativas, formatarDataHora, grupoDaSituacao, useEnvioESocial } from './esocialComum';

/** Aba "eSocial" da ficha completa: cadastro (S-2300) do cooperado e todas as tentativas de envio. */
const ESocialFichaCooperado: React.FC<{ candidatoId: number; temMatricula: boolean; temAlocacao: boolean }> = ({ candidatoId, temMatricula, temAlocacao }) => {
  const { podeEnviar } = useAcessoESocial();
  const [tentativas, setTentativas] = useState<TentativaESocial[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [recibo, setRecibo] = useState('');
  const [mostrarExistente, setMostrarExistente] = useState(false);

  const carregar = useCallback(() => {
    obterHistoricoESocial(candidatoId).then(setTentativas).catch((e) => setErro(e.message)).finally(() => setCarregando(false));
  }, [candidatoId]);
  useEffect(() => { carregar(); }, [carregar]);
  const { progresso, enviar, consultarRetornos, limpar } = useEnvioESocial(carregar);

  const cadastro = tentativas.find((t) => t.tipo === 'S-2300') ?? null;
  const cadastroAceito = tentativas.find((t) => t.tipo === 'S-2300' && t.status === 'aceito') ?? null;
  const grupo = grupoDaSituacao(cadastro?.status);

  useEffect(() => { if (grupo === 'aguardando') consultarRetornos(); }, [grupo]); // eslint-disable-line react-hooks/exhaustive-deps

  const marcarExistente = async () => {
    try {
      await marcarCadastrosExistentes([candidatoId], recibo.trim() || undefined);
      setMostrarExistente(false);
      carregar();
    } catch (e) { setErro(e instanceof Error ? e.message : 'Erro ao registrar.'); }
  };

  if (carregando) return <div style={{ color: '#888', padding: 16 }}>Carregando…</div>;

  return (
    <div>
      <div style={{ border: '1px solid #e0e0e0', borderRadius: 10, padding: 16, marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6 }}>Cadastro no eSocial (S-2300)</div>
            <BadgeStatus status={cadastro?.status} />
            {cadastro && <span style={{ marginLeft: 8, fontSize: 12, color: '#888' }}>{formatarDataHora(cadastro.criado_em)}</span>}
            {cadastroAceito && (
              <div style={{ fontSize: 12, color: '#2e7d32', marginTop: 6 }}>
                {cadastroAceito.origem === 'externo' ? 'Cadastrado por outro sistema' : `Recibo ${cadastroAceito.nr_recibo}`}
              </div>
            )}
            {cadastro && grupo === 'erros' && <ListaOcorrencias ocorrencias={cadastro.ocorrencias} descricao={cadastro.desc_resposta} />}
            {!temAlocacao && !cadastro && <div style={{ fontSize: 12, color: '#e65100', marginTop: 6 }}>O cadastro no eSocial é enviado após a alocação do cooperado.</div>}
            {!temMatricula && <div style={{ fontSize: 12, color: '#e65100', marginTop: 6 }}>Cooperado sem matrícula: obrigatória para o eSocial.</div>}
          </div>
          {podeEnviar && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {(grupo === 'nao_enviados' || grupo === 'erros') && (
                <IonButton size="small" shape="round" color="success" disabled={progresso.emAndamento || !temAlocacao}
                  onClick={() => enviar({ tipo: 'S-2300', candidatoIds: [candidatoId] })}>
                  {grupo === 'erros' ? 'Corrigi os dados — reenviar' : 'Enviar ao eSocial'}
                </IonButton>
              )}
              {cadastro?.status === 'aceito' && cadastroAceito?.nr_recibo && (
                <IonButton size="small" shape="round" fill="outline" color="success" disabled={progresso.emAndamento}
                  onClick={() => window.confirm('Enviar retificação do cadastro com os dados atuais da ficha?') && enviar({ tipo: 'S-2300', candidatoIds: [candidatoId], retificar: true })}>
                  Retificar cadastro
                </IonButton>
              )}
              {!cadastroAceito && grupo !== 'aguardando' && (
                <IonButton size="small" shape="round" fill="outline" color="success" onClick={() => setMostrarExistente((v) => !v)}>Já cadastrado no eSocial</IonButton>
              )}
            </div>
          )}
        </div>
        {mostrarExistente && (
          <div style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', fontSize: 12 }}>
            <span>Cooperado cadastrado no eSocial por outro sistema. Recibo do S-2300 (opcional):</span>
            <input className="form-input" style={{ maxWidth: 260 }} placeholder="1.1.0000000000000000000" value={recibo} onChange={(e) => setRecibo(e.target.value)} />
            <IonButton size="small" shape="round" color="success" onClick={marcarExistente}>Registrar</IonButton>
          </div>
        )}
      </div>

      <PainelProgresso progresso={progresso} onFechar={limpar} />
      {erro && <div className="form-erro" style={{ marginBottom: 12 }}>{erro}</div>}

      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>Todas as tentativas de envio (cadastro, remunerações e pagamentos)</div>
      <TabelaTentativas tentativas={tentativas} />
    </div>
  );
};

export default ESocialFichaCooperado;
