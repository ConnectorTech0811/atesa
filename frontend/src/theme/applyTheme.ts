/**
 * Aplica a identidade visual da empresa (cores e nome) definida no .env
 * sobre as variáveis CSS padrão (theme/variables.css). Isso permite que
 * o mesmo código seja buildado para empresas diferentes apenas trocando
 * o arquivo .env, sem alterar nenhuma linha de CSS ou componente.
 */
export function applyTheme(): void {
  const root = document.documentElement.style;
  const env = import.meta.env;

  const mapeamento: Record<string, string | undefined> = {
    '--atesa-green': env.VITE_BRAND_PRIMARY_COLOR,
    '--atesa-green-dark': env.VITE_BRAND_PRIMARY_DARK,
    '--atesa-green-light': env.VITE_BRAND_PRIMARY_LIGHT,
    '--atesa-gray': env.VITE_BRAND_SECONDARY_COLOR,

    '--ion-color-primary': env.VITE_BRAND_PRIMARY_COLOR,
    '--ion-color-primary-shade': env.VITE_BRAND_PRIMARY_DARK,
    '--ion-color-primary-tint': env.VITE_BRAND_PRIMARY_LIGHT,

    '--ion-color-secondary': env.VITE_BRAND_SECONDARY_COLOR,

    '--ion-background-color': env.VITE_BRAND_BACKGROUND,
  };

  Object.entries(mapeamento).forEach(([variavel, valor]) => {
    if (valor) root.setProperty(variavel, valor);
  });

  if (env.VITE_APP_NAME) {
    document.title = env.VITE_APP_NAME;
  }
}

export function getLogoPath(): string {
  return import.meta.env.VITE_BRAND_LOGO || '/atesa_logo.png';
}

export function getAppName(): string {
  return import.meta.env.VITE_APP_NAME || 'ATESA';
}
