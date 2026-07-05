-- Executado apenas na primeira inicialização do volume do MySQL.
-- Cada microsserviço tem seu próprio banco lógico, sem acesso aos
-- bancos dos outros serviços (nada de FK entre bases distintas).

CREATE DATABASE IF NOT EXISTS regioes_db CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
CREATE DATABASE IF NOT EXISTS usuarios_db CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
CREATE DATABASE IF NOT EXISTS empresas_db CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

GRANT ALL PRIVILEGES ON regioes_db.* TO 'atesa'@'%';
GRANT ALL PRIVILEGES ON usuarios_db.* TO 'atesa'@'%';
GRANT ALL PRIVILEGES ON empresas_db.* TO 'atesa'@'%';
FLUSH PRIVILEGES;
