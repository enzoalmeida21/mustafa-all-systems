# Estrategia de Migracao - Fluxo Polido do Promotor

## Principio: Camada Adicional, Sem Quebra

Todas as mudancas foram implementadas como uma **camada adicional** sobre o codigo existente.
O fluxo antigo (backend HTTP + Firebase Storage) continua funcionando normalmente.

## O que foi adicionado

### Mobile

1. **Maquina de estados da visita** (`mobile/src/features/visits/`)
   - `types.ts` - Tipos e validacao de transicoes
   - `visitFlowStorage.ts` - Persistencia local via AsyncStorage
   - `useVisitFlow.ts` - Hook centralizado para estado da visita
   - O hook e usado **em paralelo** com as chamadas ao backend existentes
   - Se o backend estiver offline, o estado local garante continuidade

2. **Servico de sincronizacao offline** (`mobile/src/services/offlineSyncService.ts`)
   - Fila de sync para fotos e pesquisas de preco
   - Monitora conexao via `@react-native-community/netinfo`
   - Tenta sincronizar automaticamente ao reconectar
   - Botao manual "Sincronizar Agora" na tela de trabalho

3. **Integracoes nas telas existentes**
   - `HomeScreen` - Usa estado local como fallback quando backend offline; mostra info da visita ativa e pendencias
   - `CheckInScreen` - Persiste visita localmente antes de chamar backend
   - `ActiveVisitScreen` - Persiste fotos localmente; botao de sync manual; indicador de pendencias
   - `CheckoutScreen` - Transicoes de estado local; aviso de pendencias antes do checkout

### Web

1. **Servico de dados de visitas** (`web/src/services/visitDataService.ts`)
   - Endpoints para Supervisor (filtros por promotor/loja/industria/mes)
   - Endpoints para Dono de Industria (acesso restrito)

2. **Dashboard do Dono de Industria** (`web/src/pages/IndustryOwnerDashboard.tsx`)
   - Abas por industria
   - Filtros por loja e mes
   - Galeria de fotos

3. **Roteamento** - `IndustryOwnerRoute` adicionado em `App.tsx`

4. **Navegacao** - Link "Minha Industria" para role `INDUSTRY_OWNER` no Layout

### Shared

1. **Tipos Firestore** adicionados em `shared/types/index.ts`
   - `FirestoreVisitDoc`, `FirestorePhotoDoc`, `FirestorePriceSurveyDoc`
   - `FirestorePromoterDoc`, `FirestoreStoreDoc`, `FirestoreIndustryDoc`

2. **Novos roles** - `INDUSTRY_OWNER` e `ADMIN` adicionados ao enum `UserRole`

### Backend

1. **Prisma schema** - `INDUSTRY_OWNER` adicionado ao enum `UserRole`

### Firebase

1. **firestore.rules** - Regras de seguranca por role (Promoter, Supervisor, IndustryOwner, Admin)
2. **storage.rules** - Regras para upload de fotos (max 10MB, apenas imagens)

## Como migrar gradualmente

### Fase 1: Deploy sem quebra (atual)
- O codigo novo coexiste com o antigo
- Backend continua como fonte de verdade
- Estado local e uma camada de resiliencia

### Fase 2: Ativar Firestore (proxima)
- Backend passa a espelhar dados em Firestore alem do Postgres
- Web pode comecar a ler diretamente do Firestore (via SDK)
- Deploy das regras: `firebase deploy --only firestore:rules,storage`

### Fase 3: Migrar leitura do web para Firestore
- Dashboard de Supervisor le de Firestore (mais rapido, realtime)
- Dashboard de IndustryOwner le de Firestore
- Backend continua como API de escrita

### Fase 4: Offline completo no mobile
- Mobile grava direto no Firestore (via SDK) quando online
- Quando offline, grava local e sincroniza depois
- Backend pode ser simplificado para validacoes e operacoes admin

## Prisma Migration

Para aplicar a mudanca do enum UserRole:

```bash
cd backend
npx prisma migrate dev --name add_industry_owner_role
```

## Riscos e mitigacoes

| Risco | Mitigacao |
|-------|-----------|
| Estado local diverge do backend | Sync automatico + manual; backend sempre e fonte de verdade |
| Fotos duplicadas | Hash SHA-256 no fluxo de captura (a implementar) |
| Role INDUSTRY_OWNER nao existe no banco | Migration Prisma necessaria antes de usar |
| Regras Firestore incorretas | Testar com emulator antes de deploy |
