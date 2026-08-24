/**
 * Acesso mínimo à tabela ra_candidatos para que o beneficios-service
 * possa validar a existência do cooperado sem depender do ra-service.
 */
import { pool } from '../config/database.js';

export async function buscarCandidatoPorId(candidatoId) {
  const [[row]] = await pool.query(
    `SELECT id, nome, cpf, telefone, email, cooperativa, matricula, status
     FROM ra_candidatos WHERE id = ?`,
    [candidatoId]
  );
  return row ?? null;
}
