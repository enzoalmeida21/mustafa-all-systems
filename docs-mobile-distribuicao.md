## Distribuição do app mobile (provisório sem lojas)

Este guia explica como distribuir o app de promotores **sem publicar ainda na Google Play / App Store**, usando:

- **Android**: APK por versão (instalação manual).
- **iOS**: via **Expo Go** (rodando o bundle publicado no Expo).

---

### 1. Backend de produção (pré-requisito)

Antes de distribuir:

- Backend rodando no Cloud Run, acessível em:
  - `https://gestaomustafa-1021788471298.us-central1.run.app`
- Todas as chamadas do mobile usam a API:
  - `https://gestaomustafa-1021788471298.us-central1.run.app/api`

No código (`mobile/src/config/api.ts`) o fallback de produção já aponta para essa URL e, nos perfis do EAS, a variável `EXPO_PUBLIC_API_URL` também foi configurada.

---

### 2. Android – APK por versão (sem Play Store)

#### 2.1. Profile de build (já configurado)

Arquivo `mobile/eas.json`:

```json
{
  "build": {
    "production": {
      "env": {
        "EXPO_PUBLIC_API_URL": "https://gestaomustafa-1021788471298.us-central1.run.app/api"
      },
      "android": {
        "buildType": "apk"
      }
    }
  }
}
```

#### 2.2. Gerar APK

No terminal:

```bash
cd mobile
npx eas-cli@latest build -p android --profile production
```

- Ao final, o EAS mostrará um **link para o APK** (ex.: `https://expo.dev/.../artifacts/android.apk`).
- Baixe esse arquivo `.apk` e envie para os promotores (WhatsApp, e‑mail, etc.).

#### 2.3. Instalação no Android

No aparelho Android:

1. Ativar “Permitir instalação de apps de fontes desconhecidas” (uma vez só).
2. Abrir o link do APK.
3. Baixar e instalar.

O app já virá apontando para o backend em produção no Cloud Run.

---

### 3. iOS – Expo Go (sem conta Apple Developer)

Sem conta Apple Developer paga ainda, o caminho é usar **Expo Go**.

#### 3.1. Publicar o bundle de produção (EAS Update)

No terminal:

```bash
cd mobile
npx eas-cli@latest update --branch production --message "Release produção"
```

Isso publica a versão mais recente do app (Android e iOS) no branch `production` do Expo.

#### 3.2. Instalação e acesso no iPhone

No iPhone do usuário:

1. Instalar **Expo Go** pela App Store.
2. Abrir o link do projeto no Expo (ex.):
   - `https://expo.dev/accounts/ozentech/projects/promo-gestao-mobile`
3. Dentro dessa página haverá:
   - QR Code para abrir no Expo Go.
   - Botão “Open in Expo Go”.

O usuário pode:

- Criar uma conta Expo gratuita, ou
- Em muitos casos, abrir o link/QR diretamente sem login (dependendo da visibilidade do projeto).

---

### 4. Resumo para envio ao time

#### Android (APK)

1. Você gera o APK com:
   ```bash
   cd mobile
   npx eas-cli@latest build -p android --profile production
   ```
2. Baixa o `.apk` do link que o EAS mostrar.
3. Envia o arquivo/link para o promotor instalar manualmente.

#### iOS (Expo Go)

1. Usuário instala **Expo Go**.
2. Abre o link do projeto `promo-gestao-mobile` no `expo.dev` e segue as instruções para abrir no Expo Go.

Quando a conta Apple Developer estiver pronta e as lojas aprovando, podemos migrar:

- Android: de APK direto → Google Play.
- iOS: de Expo Go → TestFlight / App Store.

