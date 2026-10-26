# NFS-e: viabilidade de emissão automática por prefeitura

Situação em 20/10/2026, atualizada em 24/10/2026. **Nenhuma integração está ativa.** As notas são emitidas no portal da prefeitura
e registradas no processo de faturamento (número, série, data, código de verificação, PDF/XML).
A tentativa de "emitir automaticamente" responde 501 com as pendências cadastradas para a prefeitura.
A análise de cada prefeitura fica em **Faturamento → Prefeituras (NFS-e)** (tabela `fiscal_municipios`)
e deve ser mantida lá. Este documento registra o ponto de partida.

## 1. Premissas que precisam de confirmação da ATESA e da contabilidade

| # | Pendência | Por que importa |
|---|-----------|-----------------|
| 1 | ~~Município(s) onde a ATESA (prestador) está inscrita e emite NFS-e~~ **Respondido em 24/10/2026:** São Paulo/SP, Recife/PE, Fortaleza/CE e Santo André/SP. | A nota é emitida pela prefeitura do **prestador**, não do cliente. Falta a inscrição municipal de cada uma. |
| 2 | Inscrição municipal, regime de tributação e regras de ISS da cooperativa | Definem os campos obrigatórios da nota e a alíquota, que o sistema não calcula. |
| 3 | Item da LC 116 / código de tributação municipal / CNAE do serviço | Define, entre outras coisas, onde o ISS é devido. Alguns serviços são tributados no local da prestação, o que torna relevante a cidade do cliente. |
| 4 | Regras de retenção (ISS, IRRF, PIS/COFINS/CSLL, INSS) por cliente | O sistema só registra os valores informados. |
| 5 | Certificado digital A1 da ATESA e quem pode usá-lo | É necessário para a API Nacional e para a maioria dos webservices municipais. |
| 6 | Acesso ao ambiente de testes (homologação / produção restrita) | É preciso homologar antes de emitir notas reais. |
| 7 | Responsável por cancelamento e substituição de notas | Define o fluxo e as permissões no sistema. |

## 2. Formas de integração (da preferida para a menos preferida)

1. **API da NFS-e Nacional (Sefin Nacional / ADN).** A LC 214/2025 levou os municípios ao padrão nacional
   a partir de 2026, seja com o emissor nacional, seja com sistema próprio integrado à plataforma nacional.
   Onde o município do prestador emite pelo padrão nacional, a integração é por API REST com XML assinado
   pelo certificado A1. É estável e documentada, e não depende da tela do portal.
2. **Webservice da prefeitura.** Vale para municípios que mantêm sistema próprio com API (ex.: o
   webservice da Nota Paulistana em São Paulo, que hoje é usado para consulta e emissão retroativa).
3. **RPA (automação do portal)**, só como último recurso. Quebra quando o portal muda e pode esbarrar em
   captcha, MFA ou certificado no navegador, além de exigir credenciais de acesso guardadas no robô. Os termos
   de uso do portal também precisam ser verificados. Não recomendado quando existe uma das opções acima.

## 3. Prefeituras emissoras da ATESA (pesquisa de 24/10/2026)

A ATESA emite NFS-e em **quatro** prefeituras. O sistema aceita várias emissoras e, na nota, usa por padrão a
emissora da cidade do cliente. A análise abaixo é o pré-preenchimento do botão "Cadastrar emissoras com análise
pesquisada" em Faturamento → Prefeituras (NFS-e) (`frontend/src/pages/dashboard/monitoramento/prefeiturasAtesa.ts`).
Depois de salva, vale o que estiver no cadastro.

| Município | Integração | Situação | O que se sabe | O que falta confirmar |
|-----------|-----------|----------|---------------|-----------------------|
| Recife/PE | API da NFS-e Nacional | Viável | Desde 01/01/2026 a emissão é **exclusivamente** pelo Emissor Nacional (Portaria SEFIN 42/2025). A prefeitura indica a integração por API para grande volume (emissão em lote). O ISS continua sendo pago por DAM municipal. | Inscrição municipal; homologação no ambiente de produção restrita. |
| São Paulo/SP | Webservice municipal (Nota Paulistana) ou API Nacional | Em análise | O Emissor Nacional é obrigatório para autônomos (03/08/2026) e para o Simples Nacional (01/11/2026). Para os demais contribuintes, como a cooperativa, não há data publicada: segue a Nota Fiscal Paulistana, que tem webservice (manual 3.3.4, layout baseado no nacional). | Se/quando a cooperativa migra; CCM; acesso de testes. |
| Fortaleza/CE | Webservice municipal (a confirmar) | Em análise | A SEFIN publicou em 30/12/2025 uma nova versão da NFS-e, compatível com o padrão nacional (campos da Reforma obrigatórios desde a competência 01/2026). Não foi encontrada documentação pública do webservice. | Se mantém emissor próprio ou aderiu ao Emissor Nacional; manual/WSDL e homologação. |
| Santo André/SP | API da NFS-e Nacional (a confirmar) | Em análise | Fontes de 2026 indicam adesão ao Emissor Nacional (Simples obrigado em 01/11/2026), mas também mencionam uma nova versão do GissOnline em jul/2026. | Qual sistema a cooperativa deve usar. |

**Cidades dos clientes em que a ATESA não emite:** Barueri/SP, Goiânia/GO, Londrina/PR e Nova Lima/MG. Servem só
como referência de retenção e de local de incidência do ISS, e não precisam de integração.

Fontes: [Prefeitura de São Paulo: uso do Emissor Nacional](https://prefeitura.sp.gov.br/web/fazenda/w/usoemissornacional),
[Nota Fiscal Paulistana: Reforma Tributária (FAQ)](https://notadomilhao.sf.prefeitura.sp.gov.br/categoria_perguntas_respostas/reforma-tributaria/),
[Prefeitura do Recife: transição para a NFS-e Nacional](https://recifeemdia.recife.pe.gov.br/nfsetransicao),
[Portaria SEFIN Recife nº 42/2025](https://www.legisweb.com.br/legislacao/?id=484107),
[SEFIN Fortaleza: nova versão da NFS-e (Tax Prático)](https://www.taxpratico.com.br/detalhes-artigo/sefin-fortaleza-nova-versao-nfs-e-campos-da-reforma-tributaria-obrigatorios-a-partir-da-competencia-01-2026),
[NFS-e em Santo André 2026](https://notafiscalafiliados.com.br/nfse/santo-andre-sp), [nfe.io: Santo André](https://nfe.io/docs/prefeituras-integradas/sao-paulo/santo-andre-sp-3547809/).
As fontes de terceiros (Fortaleza e Santo André) precisam ser confirmadas com a prefeitura antes de qualquer implementação.

## 4. O que já está pronto no sistema para receber a integração

- `faturamento_notas`: dados fiscais completos, status, `modo_emissao` (`manual_portal`, `api` ou `rpa`), documentos (PDF/XML) e histórico.
- `fiscal_municipios`: forma de integração, situação, requisitos e pendências por prefeitura.
- Ponto único de entrada: `emitirNotaAutomaticamente()` em `notasCobrancasRepository.js`. Hoje responde 501
  e nunca simula uma emissão. A integração escolhida deve ser implementada ali, depois da homologação.
