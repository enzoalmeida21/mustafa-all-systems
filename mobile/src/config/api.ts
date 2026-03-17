// Configuração da API
// Em produção (GCP): defina EXPO_PUBLIC_API_URL com a URL do Cloud Run (ex.: https://sua-api.run.app/api).
// Ver docs/DEPLOY_GCP_FIREBASE.md. Fallback abaixo para compatibilidade (ex.: Render).

const DEFAULT_PROD_API_URL = 'https://gestaomustafa-1021788471298.us-central1.run.app/api';

// Em builds EAS/produção, `process.env.EXPO_PUBLIC_*` é injetado em build-time pelo Expo.
// Em alguns runtimes o `process.env` pode vir vazio; por isso mantemos um fallback seguro.
const API_URL =
  (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_API_URL)
    ? process.env.EXPO_PUBLIC_API_URL
    : DEFAULT_PROD_API_URL;

// Log da URL configurada (apenas em desenvolvimento)
if (typeof __DEV__ !== 'undefined' && __DEV__) {
  console.log('🔧 Configuração da API:');
  console.log('   EXPO_PUBLIC_API_URL:', process.env?.EXPO_PUBLIC_API_URL || 'NÃO DEFINIDO - usando produção');
  console.log('   API_URL final:', API_URL);
}

export default {
  BASE_URL: API_URL,
  ENDPOINTS: {
    AUTH: {
      LOGIN: `${API_URL}/auth/login`,
      REFRESH: `${API_URL}/auth/refresh`,
    },
    PROMOTER: {
      STORES: `${API_URL}/promoters/stores`,
      CHECKIN: `${API_URL}/promoters/checkin`,
      CHECKOUT: `${API_URL}/promoters/checkout`,
      PHOTOS: `${API_URL}/promoters/photos`,
      PRICE_RESEARCH: `${API_URL}/promoters/price-research`,
      CURRENT_VISIT: `${API_URL}/promoters/current-visit`,
    },
    UPLOAD: {
      PHOTO: `${API_URL}/upload/photo`,
    },
  },
};
