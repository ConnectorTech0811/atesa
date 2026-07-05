import jwt from 'jsonwebtoken';
import { config } from './config.js';

/** Exige um Bearer token válido (emitido pelo usuarios-service) para seguir adiante. */
export function verificarToken(req, res, next) {
  const cabecalho = req.headers.authorization;
  if (!cabecalho || !cabecalho.startsWith('Bearer ')) {
    return res.status(401).json({ erro: 'Token de autenticação não informado.' });
  }

  const token = cabecalho.slice('Bearer '.length);
  try {
    req.usuario = jwt.verify(token, config.jwtSecret);
    next();
  } catch {
    return res.status(401).json({ erro: 'Token inválido ou expirado.' });
  }
}
