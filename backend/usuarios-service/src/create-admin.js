import bcrypt from 'bcryptjs';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve('.env') });

async function createAdmin() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
  });

  const senha = 'admin';
  const hash = await bcrypt.hash(senha, 10);
  const email = 'admin@admin.com';

  console.log('Inserindo usuario...', email);
  
  await connection.query(
    `INSERT INTO usuarios (nome, email, senha_hash, tipo_usuario, ativo, trocar_senha) 
     VALUES (?, ?, ?, ?, 1, 0)`,
    ['Administrador Master', email, hash, 'administrador']
  );

  console.log('Usuario inserido com sucesso!');
  console.log('Email:', email);
  console.log('Senha:', senha);

  await connection.end();
}

createAdmin().catch(console.error);
