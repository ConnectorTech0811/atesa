import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../../../.env') });
dotenv.config({ path: path.join(__dirname, '../../.env') });

export const env = {
  port: Number(process.env.COMERCIAL_PORT ?? process.env.PORT ?? 3006),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  db: {
    host: process.env.DB_HOST ?? 'br1104.hostgator.com.br',
    port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USER ?? 'conn0686_atesa',
    password: process.env.DB_PASSWORD ?? process.env.DB_PASS ?? 'ConnectorTech@2280@',
    database: process.env.DB_NAME ?? 'conn0686_atesa',
  },
};
