/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_APP_NAME: string;
  readonly VITE_BRAND_PRIMARY_COLOR: string;
  readonly VITE_BRAND_PRIMARY_DARK: string;
  readonly VITE_BRAND_PRIMARY_LIGHT: string;
  readonly VITE_BRAND_SECONDARY_COLOR: string;
  readonly VITE_BRAND_BACKGROUND: string;
  readonly VITE_BRAND_LOGO: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
