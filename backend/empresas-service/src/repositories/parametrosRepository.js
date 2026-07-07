import { pool } from '../config/database.js';

export async function obterParametrosPorTrabalho(trabalhoId) {
  const [linhas] = await pool.query(
    'SELECT * FROM parametros_trabalho WHERE trabalho_id = ?',
    [trabalhoId]
  );
  return linhas[0] ?? null;
}

export async function salvarParametros(trabalhoId, { cargo, quantidade, descricaoCargo, salario, beneficios, localTrabalho, horario, requisitos, observacoes }) {
  await pool.query(
    `INSERT INTO parametros_trabalho
       (trabalho_id, cargo, quantidade, descricao_cargo, salario, beneficios, local_trabalho, horario, requisitos, observacoes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       cargo = VALUES(cargo), quantidade = VALUES(quantidade), descricao_cargo = VALUES(descricao_cargo),
       salario = VALUES(salario), beneficios = VALUES(beneficios), local_trabalho = VALUES(local_trabalho),
       horario = VALUES(horario), requisitos = VALUES(requisitos), observacoes = VALUES(observacoes),
       atualizado_em = NOW()`,
    [trabalhoId, cargo ?? null, quantidade ?? null, descricaoCargo ?? null, salario ?? null,
     beneficios ?? null, localTrabalho ?? null, horario ?? null, requisitos ?? null, observacoes ?? null]
  );
}
