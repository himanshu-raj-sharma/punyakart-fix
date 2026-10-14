/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_RAZORPAY_KEY_ID: string;
  readonly VITE_NGO_UPI_VPA?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
