import React, { useState, useEffect } from 'react';
import Card, { CardHeader, CardContent } from '../components/ui/Card';
import Button from '../components/ui/Button';

/** URL estática (sempre funciona em S3). A rota /privacy depende do SPA (CloudFront). */
const PRIVACY_STATIC = '/privacy.html';
const PRIVACY_SPA = '/privacy';

/**
 * Página interna (rota oculta): checklist e referência para Play Store / App Store / EAS.
 * Não aparece no menu lateral — acesse pela URL direta (admin).
 */

const MOBILE_ROOT = 'mustafa-all-systems/mobile';

const IDENTIFIERS = {
  expoSlug: 'promo-gestao-mobile',
  easProjectId: 'ec7a3510-8d52-4352-bb9d-3362ffacb03f',
  androidPackage: 'com.promogestao.mobile',
  iosBundleId: 'com.promogestao.mobile',
  apiProd: 'https://gestaomustafa-1021788471298.us-central1.run.app/api',
};

function ChecklistItem({
  id,
  label,
  checked,
  onToggle,
}: {
  id: string;
  label: string;
  checked: boolean;
  onToggle: (id: string) => void;
}) {
  return (
    <label className="flex items-start gap-3 cursor-pointer group">
      <input
        type="checkbox"
        checked={checked}
        onChange={() => onToggle(id)}
        className="mt-1 rounded border-dark-border text-primary-600 focus:ring-primary-500"
      />
      <span className="text-sm text-text-secondary group-hover:text-text-primary">{label}</span>
    </label>
  );
}

export default function AppStoreReleaseOps() {
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [privacyPageOrigin, setPrivacyPageOrigin] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setPrivacyPageOrigin(window.location.origin);
    }
  }, []);

  const privacyStaticUrl =
    privacyPageOrigin ? `${privacyPageOrigin}${PRIVACY_STATIC}` : `https://SEU_DOMINIO${PRIVACY_STATIC}`;
  const privacySpaUrl =
    privacyPageOrigin ? `${privacyPageOrigin}${PRIVACY_SPA}` : `https://SEU_DOMINIO${PRIVACY_SPA}`;

  async function copyPrivacyUrl() {
    try {
      await navigator.clipboard.writeText(privacyStaticUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('Copie a URL:', privacyStaticUrl);
    }
  }

  const toggle = (id: string) => {
    setChecks((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const playItems = [
    { id: 'gp-account', label: 'Conta Google Play Console ativa (taxa única de desenvolvedor paga)' },
    { id: 'gp-app', label: 'App criado no Play Console com package name igual ao app.json (Android)' },
    { id: 'gp-signing', label: 'Assinatura: EAS gerencia credenciais ou upload da chave de upload' },
    { id: 'gp-aab', label: 'Build de produção (AAB recomendado para loja — ajustar eas.json se necessário)' },
    { id: 'gp-listing', label: 'Listagem: título, descrição, screenshots, ícone, classificação etária' },
    { id: 'gp-privacy', label: 'Política de privacidade: URL pública HTTPS na ficha da loja (veja seção abaixo)' },
    { id: 'gp-privacy-sensitive', label: 'Obrigatório se o app usa dados sensíveis/permissões — transparência para o usuário' },
    { id: 'gp-children', label: 'Se o público incluir menores de 13 anos: política obrigatória + conformidade extra (COPPA/Family)' },
    { id: 'gp-userdatapolicy', label: 'Formulário “Política de dados do usuário” / declarações alinhadas à User Data policy do Google' },
    { id: 'gp-perms', label: 'Revisar declaração de permissões (câmera, localização, armazenamento)' },
  ];

  const appleItems = [
    { id: 'as-account', label: 'Apple Developer Program ativo' },
    { id: 'as-app', label: 'App no App Store Connect com bundle ID igual ao app.json (iOS)' },
    { id: 'as-cert', label: 'Certificados / provisioning via EAS (eas credentials)' },
    { id: 'as-build', label: 'Build iOS production concluído (EAS)' },
    { id: 'as-listing', label: 'Metadados, screenshots e informações de privacidade (App Privacy)' },
    { id: 'as-review', label: 'Notas para revisão + conta de teste se a Apple pedir' },
  ];

  const easItems = [
    { id: 'eas-cli', label: 'eas-cli instalado e logado (npx eas-cli login)' },
    { id: 'eas-env', label: 'EXPO_PUBLIC_API_URL definida no eas.json (produção) ou no publish' },
    { id: 'eas-build-android', label: 'eas build --platform android --profile production' },
    { id: 'eas-build-ios', label: 'eas build --platform ios --profile production (mac não obrigatório no EAS)' },
    { id: 'eas-submit', label: 'eas submit (ou upload manual do AAB/IPA nas consoles)' },
    { id: 'eas-update', label: 'eas update para OTA (JS) após build nativo compatível com runtimeVersion' },
  ];

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-primary-600 to-accent-500 bg-clip-text text-transparent">
          Publicação do app mobile
        </h1>
        <p className="text-text-secondary mt-2">
          Rota interna — não listada no menu. Use como guia para Play Store, App Store e EAS (Expo).
        </p>
      </div>

      <Card>
        <CardHeader>
          <h2 className="text-xl font-semibold text-text-primary">Privacy Policy (Google Play)</h2>
          <p className="text-sm text-text-tertiary mt-1">
            A Play Console pede uma política de privacidade na listagem para dar transparência sobre dados sensíveis e do
            dispositivo. Se o público-alvo incluir crianças menores de 13 anos, a política é obrigatória e há regras
            adicionais — consulte a{' '}
            <a
              href="https://support.google.com/googleplay/android-developer/answer/10787469"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary-400 hover:underline"
            >
              User Data policy
            </a>{' '}
            para evitar violações comuns.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-primary-600/30 bg-primary-600/10 p-4 text-sm text-text-secondary">
            <p className="font-medium text-text-primary mb-2">O que fazer na prática</p>
            <ol className="list-decimal list-inside space-y-2">
              <li>
                Publique o site web na mesma URL em produção (HTTPS). Esta base já inclui uma página pública de{' '}
                <strong className="text-text-primary">Política de privacidade</strong>.
              </li>
              <li>
                No Play Console → seu app → <strong className="text-text-primary">Política de privacidade</strong>,
                cole a URL <strong className="text-text-primary">{PRIVACY_STATIC}</strong> (estática, recomendada em
                S3) — veja o campo abaixo.
              </li>
              <li>
                Preencha o questionário de <strong className="text-text-primary">segurança dos dados</strong> / declarações
                de coleta de dados de forma coerente com o que o app realmente faz (câmera, localização, conta, etc.).
              </li>
              <li>
                <strong className="text-text-primary">Menores de 13:</strong> o texto em {PRIVACY_STATIC} declara que o
                app não é direcionado a crianças. Se você marcar público infantil na Play Console, revise políticas
                Family (Google Play) e obtenha assessoria jurídica.
              </li>
            </ol>
          </div>

          <div className="rounded-lg border border-dark-border bg-dark-card/40 p-3 text-xs text-text-tertiary">
            <strong className="text-text-secondary">Deploy em S3 + CloudFront:</strong> caminhos como{' '}
            <code className="text-primary-400">{PRIVACY_SPA}</code> só carregam o React se o CloudFront entregar{' '}
            <code className="text-primary-400">index.html</code> para erros 403/404. Caso contrário, a página fica em
            branco. Use <code className="text-primary-400">{PRIVACY_STATIC}</code> na Play Console ou configure o SPA
            conforme <code className="text-primary-400">docs/infra/SPA_S3_CLOUDFRONT.md</code> no repositório.
          </div>

          <div>
            <p className="text-sm text-text-tertiary mb-2">URL recomendada para a Play Console (estática)</p>
            <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
              <code className="flex-1 px-3 py-2 rounded-lg bg-dark-card border border-dark-border text-xs text-primary-300 break-all">
                {privacyStaticUrl}
              </code>
              <Button type="button" variant="outline" size="sm" onClick={copyPrivacyUrl}>
                {copied ? 'Copiado!' : 'Copiar URL'}
              </Button>
            </div>
            <p className="text-xs text-text-tertiary mt-2">
              Rota SPA (após CloudFront configurado):{' '}
              <a href={PRIVACY_SPA} target="_blank" rel="noopener noreferrer" className="text-primary-400 hover:underline break-all">
                {privacySpaUrl}
              </a>
            </p>
            <p className="text-xs text-text-tertiary mt-2">
              <a
                href={PRIVACY_STATIC}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary-400 hover:underline"
              >
                Abrir política (estática) em nova aba
              </a>
            </p>
          </div>

          <div>
            <p className="text-sm font-medium text-text-primary mb-2">Documentação Google</p>
            <ul className="list-disc list-inside space-y-1 text-sm text-primary-400">
              <li>
                <a
                  href="https://support.google.com/googleplay/android-developer/answer/9859455"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:underline"
                >
                  Política de privacidade e dados do usuário (Help Center)
                </a>
              </li>
              <li>
                <a
                  href="https://support.google.com/googleplay/android-developer/answer/10787469"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:underline"
                >
                  User Data policy (requisitos e violações comuns)
                </a>
              </li>
              <li>
                <a
                  href="https://support.google.com/googleplay/android-developer/answer/9898867"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:underline"
                >
                  Políticas para apps voltados a famílias / menores
                </a>
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-xl font-semibold text-text-primary">Identificadores (repo {MOBILE_ROOT})</h2>
          <p className="text-sm text-text-tertiary mt-1">
            Confira em <code className="text-primary-400">mobile/app.json</code> antes de publicar.
          </p>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-3 text-sm">
            <div className="flex flex-col sm:flex-row sm:gap-4">
              <dt className="text-text-tertiary shrink-0 w-40">Slug Expo</dt>
              <dd className="text-text-primary font-mono break-all">{IDENTIFIERS.expoSlug}</dd>
            </div>
            <div className="flex flex-col sm:flex-row sm:gap-4">
              <dt className="text-text-tertiary shrink-0 w-40">EAS project ID</dt>
              <dd className="text-text-primary font-mono break-all">{IDENTIFIERS.easProjectId}</dd>
            </div>
            <div className="flex flex-col sm:flex-row sm:gap-4">
              <dt className="text-text-tertiary shrink-0 w-40">Android applicationId</dt>
              <dd className="text-text-primary font-mono break-all">{IDENTIFIERS.androidPackage}</dd>
            </div>
            <div className="flex flex-col sm:flex-row sm:gap-4">
              <dt className="text-text-tertiary shrink-0 w-40">iOS bundleIdentifier</dt>
              <dd className="text-text-primary font-mono break-all">{IDENTIFIERS.iosBundleId}</dd>
            </div>
            <div className="flex flex-col sm:flex-row sm:gap-4">
              <dt className="text-text-tertiary shrink-0 w-40">API produção</dt>
              <dd className="text-text-primary font-mono break-all">{IDENTIFIERS.apiProd}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-xl font-semibold text-text-primary">Comandos úteis (na pasta mobile)</h2>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm text-text-tertiary mb-2">Build loja (APK/AAB conforme eas.json)</p>
            <pre className="p-4 rounded-lg bg-dark-card border border-dark-border text-xs text-text-primary overflow-x-auto">
{`cd ${MOBILE_ROOT}
npx eas-cli build --platform android --profile production
npx eas-cli build --platform ios --profile production`}
            </pre>
          </div>
          <div>
            <p className="text-sm text-text-tertiary mb-2">Enviar para as lojas (se configurado submit)</p>
            <pre className="p-4 rounded-lg bg-dark-card border border-dark-border text-xs text-text-primary overflow-x-auto">
{`npx eas-cli submit --platform android --profile production
npx eas-cli submit --platform ios --profile production`}
            </pre>
          </div>
          <div>
            <p className="text-sm text-text-tertiary mb-2">Atualização OTA (JS/assets, usuários com build nativo compatível)</p>
            <pre className="p-4 rounded-lg bg-dark-card border border-dark-border text-xs text-text-primary overflow-x-auto">
{`export EXPO_PUBLIC_API_URL="${IDENTIFIERS.apiProd}"
npx eas-cli update --branch production --message "sua mensagem"`}
            </pre>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-xl font-semibold text-text-primary">Google Play</h2>
          <p className="text-sm text-text-tertiary mt-1">Checklist (marcadores só neste navegador)</p>
        </CardHeader>
        <CardContent className="space-y-3">
          {playItems.map((item) => (
            <ChecklistItem
              key={item.id}
              id={item.id}
              label={item.label}
              checked={!!checks[item.id]}
              onToggle={toggle}
            />
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-xl font-semibold text-text-primary">App Store (Apple)</h2>
        </CardHeader>
        <CardContent className="space-y-3">
          {appleItems.map((item) => (
            <ChecklistItem
              key={item.id}
              id={item.id}
              label={item.label}
              checked={!!checks[item.id]}
              onToggle={toggle}
            />
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-xl font-semibold text-text-primary">EAS / Expo</h2>
        </CardHeader>
        <CardContent className="space-y-3">
          {easItems.map((item) => (
            <ChecklistItem
              key={item.id}
              id={item.id}
              label={item.label}
              checked={!!checks[item.id]}
              onToggle={toggle}
            />
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-xl font-semibold text-text-primary">Links externos</h2>
        </CardHeader>
        <CardContent>
          <ul className="list-disc list-inside space-y-2 text-sm text-primary-400">
            <li>
              <a
                href="https://expo.dev/accounts"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline"
              >
                Expo — conta e projeto
              </a>
            </li>
            <li>
              <a
                href="https://play.google.com/console"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline"
              >
                Google Play Console
              </a>
            </li>
            <li>
              <a
                href="https://appstoreconnect.apple.com"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline"
              >
                App Store Connect
              </a>
            </li>
            <li>
              <a
                href="https://docs.expo.dev/build/introduction/"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline"
              >
                Expo — EAS Build (documentação)
              </a>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
