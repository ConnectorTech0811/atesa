# Financeiro: regras que dependem de confirmação da ATESA

Situação em 20/10/2026. Enquanto estas respostas não chegam, o sistema **não aplica** a regra.
Em vez disso, ele registra o item como pendente, exige confirmação manual ou bloqueia a operação.

## Pagamento dos cooperados

1. **Valor bruto do cooperado.** Hoje vem da remuneração importada pelo Benefícios (eSocial: bruto, INSS, IRRF).
   É essa a fonte oficial do repasse, ou o valor deve sair da apuração do faturamento (horas × valor)?
2. **Descontos em percentual** (INSS %, seguro de vida %, rateio %, cadastrados no cooperado). Sobre qual base incidem?
   O INSS do cadastro é o mesmo INSS que já vem na remuneração importada? Lançar os dois descontaria INSS duas vezes.
3. **Quota-parte.** O valor cadastrado é o total ou o valor de cada parcela? Quando é descontada?
   O contador de cotas pagas no cadastro deve ser atualizado pelo Financeiro?
4. **"Outros descontos" e "outras" do cadastro.** São mensais (todo repasse) ou pontuais? Hoje exigem confirmação manual a cada competência.
5. **Líquido importado diferente de bruto − INSS − IRRF** (ocorre em casos reais). Isso indica outros descontos já embutidos?
6. **Recebimento do cliente.** A regra atual é que todas as cobranças dos processos de faturamento do cooperado na competência
   estejam pagas. Recebimento parcial deve liberar proporcionalmente? Cooperado com vários clientes: libera por cliente?
7. **Quem pode liberar pagamento por exceção.** Hoje somente o Administrador, ou usuário com a permissão concedida explicitamente.
8. **Cooperado inativo ou desligado com valores a receber.** Hoje o pagamento fica retido e só sai por exceção justificada.

## Adiantamentos e compensações

9. Quem pode conceder adiantamento, com quais limites (valor, percentual do previsto) e quantos por mês?
10. Compensação: o adiantamento é descontado de uma vez ou parcelado? Hoje é descontado de uma vez na competência
    informada, e o débito pode ser adiado manualmente, com motivo.
11. Os campos de adiantamento do contrato do cliente (`tera_adiantamento`, vencimento e repasse do adiantamento)
    devem liberar o adiantamento automaticamente quando o cliente pagar?
12. Quando os débitos superam os créditos (líquido negativo), qual é a regra para levar o saldo para o mês seguinte?

## Remessa bancária

13. Quais **bancos e modalidades** (crédito em conta, TED, PIX), com **leiautes e versões oficiais** (ex.: CNAB 240 de
    pagamentos/SISPAG, versão X), convênio, agência e conta pagadora. Sem isso, o sistema só gera a planilha de conferência.
14. Arquivo de retorno de pagamentos do mesmo banco, para confirmar e rejeitar automaticamente.
15. Titularidade: as contas cadastradas são sempre do próprio cooperado? Chave PIX de outra pessoa é bloqueada hoje.

## Contas a pagar

16. Plano de categorias (hoje cadastrado livremente pelo Financeiro).
17. Alçadas de aprovação: valor limite por aprovador? Quem cadastra pode aprovar a própria conta?
    Hoje é permitido e fica registrado no histórico.
18. Pagamento parcial de contas a pagar e retenções de impostos sobre serviços tomados (não implementados).
19. DDA: fora do escopo até haver integração bancária e aprovação.

## Comissões, notas fiscais e recebimentos (tarefas anteriores)

Ver `docs/nfse-integracao-viabilidade.md` e as pendências listadas na entrega anterior:
- base e pagamento das comissões;
- município, inscrição municipal e certificado da ATESA;
- banco priorizado e leiaute de retorno de cobrança;
- se a cobrança é pelo valor bruto ou líquido da nota;
- se a baixa manual exige dupla aprovação;
- se juros e multa podem ser aceitos automaticamente.

## Relatórios (2026-10-21)

20. **Modelos de relatório da ATESA.** Não foram fornecidos (exceto as planilhas de produtividade HSM/Savior/SEMSP, que já existem).
    Colunas e formatos seguem o padrão do sistema. Confirmar campos, ordem, nomes e formato de exportação.
21. **Consolidação contábil.** Sem plano de contas nem leiaute de exportação para a contabilidade, a consolidação é um resumo
    gerencial por competência (faturado → cobrado → recebido → liberado → pago), não lançamentos contábeis.
22. **Inadimplência.** Faixas de atraso de 1–30, 31–60, 61–90 e acima de 90 dias. Juros e multa por atraso não são calculados.
23. **Conciliação bancária.** Concilia arquivos de retorno com cobranças. Não há conciliação com o extrato (saldo da conta):
    falta importação de extrato e leiaute.
24. **Competência de referência.** Faturado, cobrado e recebido seguem a competência do processo; repasses, a do pagamento;
    contas a pagar, a competência informada. Confirmar se a contabilidade usa regime de competência ou de caixa.
