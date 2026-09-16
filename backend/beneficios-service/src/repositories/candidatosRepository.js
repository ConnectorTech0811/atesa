import { pool } from '../config/database.js';

export async function buscarCandidatoPorId(candidatoId) {
  const [[row]] = await pool.query(
    `SELECT id, nome, cpf, telefone, email, cooperativa, matricula, status
     FROM ra_candidatos WHERE id = ?`,
    [candidatoId]
  );
  return row ?? null;
}
