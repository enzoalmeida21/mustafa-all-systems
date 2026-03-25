# SPA (React) em S3 + CloudFront — rotas como `/privacy`

Em hospedagem estática, **não existe servidor** que interprete rotas. O bucket S3 só tem **arquivos**. Um GET em `/privacy` procura um objeto chamado `privacy` — **não existe** — e o usuário recebe **404** ou página em branco. O mesmo vale para `/login`, `/stores`, etc., **exceto** se o CloudFront (ou S3 website) devolver o `index.html` do app React.

## Solução rápida (já no repositório)

- **`/privacy.html`** — arquivo estático em `web/public/privacy.html`, copiado para `dist/` no build. Funciona em **qualquer** S3 sem configuração extra.
- Use essa URL na **Google Play Console** como política de privacidade se `/privacy` ainda não estiver configurado.

## Solução correta para todas as rotas do SPA

No **CloudFront**, configure **respostas de erro personalizadas** para entregar o `index.html` com código **200** quando o origin (S3) retornar **403** ou **404** (comportamento comum para “caminho inexistente” no bucket).

1. CloudFront → sua distribuição → **Error pages** (ou **Custom error responses**).
2. Criar entrada para **403** (e/ou **404**):
   - **Response page path**: `/index.html`
   - **HTTP response code**: **200** (opcional mas recomendado para o browser carregar o JS e o React Router tratar a URL).

Assim, ao acessar `https://seu-dominio/privacy`, o CloudFront devolve o mesmo `index.html` da raiz, o React inicia e o `react-router` mostra a página de privacidade.

**Invalidação**: após deploy, invalide `/*` no CloudFront (o workflow em `.github/workflows/deploy-web.yml` já pode fazer isso se `CLOUDFRONT_DISTRIBUTION_ID` estiver definido).

## S3 Website Hosting (sem CloudFront)

Se usar apenas o endpoint de website do S3, defina o **documento de erro** como `index.html` (alguns setups usam isso para SPA). A abordagem mais comum em produção continua sendo CloudFront com error responses.
