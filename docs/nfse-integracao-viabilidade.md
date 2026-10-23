# NFS-e: viabilidade de emissão automática por prefeitura

Situação em 20/10/2026. **Nenhuma integração está ativa.** As notas são emitidas no portal da prefeitura
e registradas no processo de faturamento (número, série, data, código de verificação, PDF/XML).
A tentativa de "emitir automaticamente" responde 501 com as pendências cadastradas para a prefeitura.
A análise de cada prefeitura fica em **Faturamento → Prefeituras (NFS-e)** (tabela `fiscal_municipios`)
e deve ser mantida lá. Este documento registra o ponto de partida.

## 1. Premissas que precisam de confirmação da ATESA e da contabilidade

| # | Pendência | Por que importa |
|---|-----------|-----------------|
| 1 | Município(s) onde a ATESA (prestador) está inscrita e emite NFS-e | A nota é emitida pela prefeitura do **prestador**, não do cliente. Esse dado não existe no sistema. |
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

## 3. Prefeituras: cidades dos clientes cadastrados

As cidades abaixo vêm do cadastro de empresas. Elas importam para retenção e local de incidência do ISS.
A prefeitura emissora é a do prestador (pendência 1).

| Município | Clientes | Situação | Observação |
|-----------|---------:|----------|------------|
| São Paulo/SP | 9 | Em análise | Aderiu ao padrão nacional (Resolução CGNFS-e nº 9/2025). Segundo a Prefeitura, o Emissor Nacional passou a ser obrigatório em 03/08/2026 para autônomos e profissionais liberais, e em 01/11/2026 para empresas do Simples Nacional. Falta confirmar a data e a forma de emissão para a cooperativa (que não é do Simples). O sistema municipal fica para consulta e emissão retroativa. |
| Recife/PE | 4 | Não analisado | Verificar adesão ao padrão nacional e se há webservice próprio. |
| Fortaleza/CE | 2 | Não analisado | Idem. |
| Santo André/SP | 3 | Não analisado | Idem. |
| Goiânia/GO | 1 | Não analisado | Idem. |
| Londrina/PR | 1 | Não analisado | Idem. |
| Barueri/SP | 1 | Não analisado | Idem. |
| Nova Lima/MG | 1 | Não analisado | Idem. |

Fontes: [Serpro: São Paulo adere ao padrão nacional](https://www.serpro.gov.br/menu/noticias/noticias-2026/sp-adere-nota-fiscal-de-servicos),
[Prefeitura de São Paulo: uso do Emissor Nacional](https://prefeitura.sp.gov.br/web/fazenda/w/usoemissornacional).
As datas devem ser conferidas no site da Prefeitura antes de qualquer decisão.

## 4. O que já está pronto no sistema para receber a integração

- `faturamento_notas`: dados fiscais completos, status, `modo_emissao` (`manual_portal`, `api` ou `rpa`), documentos (PDF/XML) e histórico.
- `fiscal_municipios`: forma de integração, situação, requisitos e pendências por prefeitura.
- Ponto único de entrada: `emitirNotaAutomaticamente()` em `notasCobrancasRepository.js`. Hoje responde 501
  e nunca simula uma emissão. A integração escolhida deve ser implementada ali, depois da homologação.
