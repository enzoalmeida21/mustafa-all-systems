# Deploy no GCP e Firebase

Este documento descreve os passos para colocar o projeto em produção usando **Google Cloud Platform (Cloud Run)** para o backend e **Firebase (Hosting + Storage)** para o front web e armazenamento de fotos.

---

## Pré-requisitos

- [ ] Conta no [Google Cloud](https://console.cloud.google.com/) com billing habilitado (para Cloud Run e Cloud SQL).
- [ ] Projeto no [Firebase Console](https://console.firebase.google.com/) (ex.: `mustafabucket`) com Storage já configurado.
- [ ] Firebase CLI instalado: `npm install -g firebase-tools` e `firebase login`.
- [ ] Docker instalado (para build da imagem do backend).
- [ ] gcloud CLI instalado e configurado: `gcloud auth login`, `gcloud config set project SEU_PROJECT_ID`.

---

## 1. Banco de dados (Cloud SQL)

1. No GCP Console, crie uma instância **Cloud SQL for PostgreSQL** (ou use Postgres externo).
2. Crie um banco (ex.: `promo_gestao`) e usuário com senha.
3. Obtenha a **connection string**. Exemplo:
   ```text
   postgresql://mustafadb:Mustafa@2026/DATABASE?host=/cloudsql/mustafa-system:southamerica-east1:mustafadb
   ```
   Para Cloud Run conectando ao Cloud SQL, use o conector Unix socket ou o IP público (com autorização de redes).
4. Anote o valor para usar como `DATABASE_URL` no Cloud Run.

---

## 2. Backend no Cloud Run

### 2.0 Deploy automático (Cloud Build trigger)

O repositório inclui **`cloudbuild.yaml`** na raiz para build e deploy automático no push para `main`.

- **Contexto do build:** a imagem é construída a partir da pasta `backend/` (`Dockerfile` e contexto em `./backend`), pois o backend fica em subpasta.
- **No trigger do Cloud Build:** use **"Cloud Build configuration file (yaml or json)"** e informe o caminho **`cloudbuild.yaml`**. Não use "Dockerfile" com raiz do repositório, pois o Dockerfile está em `backend/` e o contexto correto é `./backend`.
- **Substituições** que o trigger deve definir (já usadas no template "Deploy to Cloud Run"): `_SERVICE_NAME`, `_AR_HOSTNAME`, `_AR_PROJECT_ID`, `_AR_REPOSITORY`, `_DEPLOY_REGION`. O `SHORT_SHA` é preenchido automaticamente.

Se o build falhar com erro de Dockerfile ou COPY, confira se o trigger está usando este `cloudbuild.yaml` e não um build "Dockerfile" com contexto na raiz.

### 2.1 Build e push da imagem (manual)

Na raiz do repositório (contexto de build = pasta `backend`):

```bash
docker build -t gcr.io/SEU_PROJECT_ID/promo-gestao-backend ./backend
docker push gcr.io/SEU_PROJECT_ID/promo-gestao-backend
```

Substitua `SEU_PROJECT_ID` pelo ID do projeto GCP. Se usar Artifact Registry:

```bash
docker tag gcr.io/SEU_PROJECT_ID/promo-gestao-backend REGION-docker.pkg.dev/SEU_PROJECT_ID/REPO/IMAGE:TAG
docker push REGION-docker.pkg.dev/SEU_PROJECT_ID/REPO/IMAGE:TAG
```

### 2.2 Deploy no Cloud Run

```bash
gcloud run deploy promo-gestao-backend \
  --image gcr.io/SEU_PROJECT_ID/promo-gestao-backend \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars "NODE_ENV=production" \
  --set-env-vars "DATABASE_URL=postgresql://..." \
  --set-env-vars "JWT_SECRET=SEU_JWT_SECRET" \
  --set-env-vars "JWT_REFRESH_SECRET=SEU_JWT_REFRESH_SECRET" \
  --set-env-vars "CORS_ORIGIN=https://mustafabucket.web.app,https://mustafabucket.firebaseapp.com" \
  --set-env-vars "FIREBASE_PROJECT_ID=mustafabucket" \
  --set-env-vars "FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxx@mustafabucket.iam.gserviceaccount.com" \
  --set-env-vars "FIREBASE_STORAGE_BUCKET=mustafabucket.firebasestorage.app"
```

Para `FIREBASE_PRIVATE_KEY` e outros segredos, use **Secret Manager** e referencie no Cloud Run:

```bash
gcloud run services update promo-gestao-backend \
  --region us-central1 \
  --set-secrets="FIREBASE_PRIVATE_KEY=firebase-private-key:latest"
```

**Importante:** Não commite o arquivo `.firebase-env.txt`. Use apenas variáveis de ambiente no Cloud Run (ou Secret Manager).

### 2.3 Variáveis de ambiente necessárias

Consulte `backend/.env.example`. Resumo:

| Variável | Obrigatória | Descrição |
|----------|-------------|-----------|
| `NODE_ENV` | Sim | `production` |
| `PORT` | Não (Cloud Run define) | Porta do servidor |
| `DATABASE_URL` | Sim | Connection string do Postgres |
| `JWT_SECRET` | Sim | Chave para tokens JWT |
| `JWT_REFRESH_SECRET` | Sim | Chave para refresh tokens |
| `CORS_ORIGIN` | Sim | URLs do Firebase Hosting (e outras origens) separadas por vírgula |
| `FIREBASE_PROJECT_ID` | Sim | ID do projeto Firebase |
| `FIREBASE_CLIENT_EMAIL` | Sim | E-mail da conta de serviço Firebase |
| `FIREBASE_PRIVATE_KEY` | Sim | Chave privada (preferir Secret Manager) |
| `FIREBASE_STORAGE_BUCKET` | Sim | Nome do bucket (ex.: `mustafabucket.firebasestorage.app`) |

### 2.4 URL do backend

Após o deploy, anote a URL do serviço (ex.: `https://promo-gestao-backend-xxx-uc.a.run.app`). A API fica em `https://.../api`. Use essa URL em:

- `VITE_API_URL` no build do web (ex.: `https://.../api`).
- `EXPO_PUBLIC_API_URL` no mobile (ex.: `https://.../api`).
- `CORS_ORIGIN` deve incluir as origens que chamam a API (Firebase Hosting).

### 2.5 Migrações

O container usa `docker-entrypoint.sh`, que executa `npx prisma migrate deploy` antes de iniciar o app. As migrações rodam a cada deploy. Garanta que `DATABASE_URL` esteja correto.

---

## 3. Firebase Hosting (web)

### 3.1 Configuração

O projeto já possui `firebase.json` na raiz com `hosting.public` apontando para `web/dist`. O `.firebaserc` define o projeto default (ex.: `mustafabucket`). Ajuste se usar outro projeto:

```bash
firebase use default
# ou
firebase use SEU_PROJECT_ID
```

### 3.2 Build do web com URL da API

O front Vite usa `VITE_API_URL` em tempo de build. Defina a URL do backend (Cloud Run) antes de buildar:

```bash
cd web
VITE_API_URL=https://promo-gestao-backend-xxx.run.app/api npm run build
```

Isso gera `web/dist/`.

### 3.3 Deploy

Na raiz do repositório:

```bash
firebase deploy --only hosting
```

O site ficará em `https://mustafabucket.web.app` (ou o domínio do seu projeto).

---

## 4. Mobile (Expo / EAS)

- No código, a URL da API é lida de `EXPO_PUBLIC_API_URL`; o fallback em `mobile/src/config/api.ts` pode ser alterado para a URL do Cloud Run.
- Em **builds de produção** (EAS Build), defina a variável de ambiente:
  - No `eas.json` ou no dashboard do EAS, configure `EXPO_PUBLIC_API_URL=https://sua-api.run.app/api`.
- Assim o app mobile em produção apontará para o backend no GCP.

---

## 5. CORS

No backend (Cloud Run), `CORS_ORIGIN` deve incluir todas as origens que fazem requisições ao API:

- `https://mustafabucket.web.app`
- `https://mustafabucket.firebaseapp.com`
- Se tiver domínio customizado no Firebase Hosting, inclua também.

Exemplo: `CORS_ORIGIN=https://mustafabucket.web.app,https://mustafabucket.firebaseapp.com`

---

## 6. Resumo rápido

1. **Banco:** Criar Cloud SQL (Postgres), obter `DATABASE_URL`.
2. **Backend:** Build da imagem a partir de `backend/Dockerfile`, push para GCR/Artifact Registry, deploy no Cloud Run com todas as env vars (e secrets para chave Firebase).
3. **Web:** `cd web && VITE_API_URL=https://.../api npm run build` e `firebase deploy --only hosting`.
4. **Mobile:** Definir `EXPO_PUBLIC_API_URL` nos builds de produção.
5. **Segurança:** Nunca commitar `.firebase-env.txt` ou chaves no repositório; usar `.env.example` como referência e env/Secret Manager em produção.
