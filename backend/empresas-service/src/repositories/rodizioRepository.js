/**
 * Escolhe, dentro de uma transação já aberta, o próximo executivo da fila
 * (lista já ordenada por cadastro, vinda do usuarios-service) e avança o
 * ponteiro do rodízio. Não comita nem faz rollback — isso é responsabilidade
 * de quem chamou, para que a escolha do executivo e a inserção da empresa
 * sejam desfeitas juntas em caso de falha (ex.: CNPJ duplicado).
 */
export async function escolherExecutivo(conexao, regiaoId, executivos) {
  if (executivos.length === 0) return null;

  const [linhas] = await conexao.query(
    'SELECT proximo_indice FROM rodizio_regiao WHERE regiao_id = ? FOR UPDATE',
    [regiaoId]
  );

  const indiceAtual = linhas[0]?.proximo_indice ?? 0;
  const executivoEscolhido = executivos[indiceAtual % executivos.length];

  await conexao.query(
    `INSERT INTO rodizio_regiao (regiao_id, proximo_indice) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE proximo_indice = ?`,
    [regiaoId, indiceAtual + 1, indiceAtual + 1]
  );

  return executivoEscolhido;
}
