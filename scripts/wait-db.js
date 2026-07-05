import { execSync } from 'child_process';

const CONTAINER = 'atesa-database';
const TENTATIVAS_MAXIMAS = 30;
const INTERVALO_MS = 2000;

function estaSaudavel() {
  try {
    const status = execSync(`docker inspect --format="{{.State.Health.Status}}" ${CONTAINER}`)
      .toString()
      .trim();
    return status === 'healthy';
  } catch {
    return false;
  }
}

async function esperar() {
  console.log(`Aguardando o banco de dados (${CONTAINER}) ficar saudável...`);
  for (let tentativa = 1; tentativa <= TENTATIVAS_MAXIMAS; tentativa++) {
    if (estaSaudavel()) {
      console.log('Banco de dados pronto.');
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, INTERVALO_MS));
  }
  console.error('Tempo esgotado esperando o banco de dados ficar saudável.');
  process.exit(1);
}

esperar();
