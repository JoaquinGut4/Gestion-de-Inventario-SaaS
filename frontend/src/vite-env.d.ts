/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ADMIN_NAME?: string;
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
