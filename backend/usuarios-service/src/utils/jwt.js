import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export function gerarToken(usuario) {
  return jwt.sign(
    {
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      tipoUsuario: usuario.tipo_usuario,
      regiaoId: usuario.regiao_id,
    },
    env.jwt.secret,
    { expiresIn: env.jwt.expiresIn }
  );
}
