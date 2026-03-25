import React from 'react';
import { Link } from 'react-router-dom';

/**
 * Página pública — use a URL na Play Console / App Store (Privacy Policy URL).
 * Ex.: https://seu-dominio.com/privacy
 */

export default function PrivacyPolicy() {
  const updated = '25 de março de 2026';

  return (
    <div className="min-h-screen bg-dark-background text-text-primary">
      <div className="max-w-3xl mx-auto px-4 py-10 sm:py-14">
        <div className="mb-8">
          <Link
            to="/login"
            className="text-sm text-primary-400 hover:text-primary-300 hover:underline"
          >
            ← Voltar ao login
          </Link>
        </div>

        <header className="mb-10">
          <h1 className="text-3xl font-bold text-text-primary">Política de privacidade</h1>
          <p className="mt-2 text-text-secondary text-sm">Promo Gestão — aplicativo mobile</p>
          <p className="mt-1 text-text-tertiary text-xs">Última atualização: {updated}</p>
        </header>

        <div className="max-w-none space-y-8 text-sm leading-relaxed text-text-secondary">
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-text-primary">1. Introdução</h2>
            <p>
              Esta política descreve como o aplicativo <strong className="text-text-primary">Promo Gestão</strong>{' '}
              (doravante &quot;App&quot;) trata dados pessoais e informações do dispositivo quando utilizado por
              promotores de vendas, supervisores e demais usuários autorizados pela sua organização.
            </p>
            <p>
              O tratamento ocorre em nome do <strong className="text-text-primary">operador do sistema</strong>{' '}
              (empresa contratante / administrador da conta). Em caso de dúvidas sobre finalidades específicas do seu
              contrato de trabalho ou prestação de serviços, consulte também a política interna da sua empresa.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-text-primary">2. Dados que podemos coletar</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong className="text-text-primary">Conta e autenticação:</strong> e-mail, nome e credenciais de
                acesso (a senha é armazenada de forma segura no servidor; não a exibimos em texto claro).
              </li>
              <li>
                <strong className="text-text-primary">Dados operacionais:</strong> registros de visitas a lojas,
                check-in e check-out, horários, identificadores de visita e informações associadas ao trabalho de campo.
              </li>
              <li>
                <strong className="text-text-primary">Localização:</strong> quando você utiliza funções que exigem
                localização (por exemplo check-in/check-out ou envio de fotos com contexto de local), coletamos
                coordenadas ou dados de localização conforme permitido pelo sistema operacional e pelas permissões que
                você conceder.
              </li>
              <li>
                <strong className="text-text-primary">Imagens e arquivos:</strong> fotos e outros arquivos que você
                envia pelo App (por exemplo fachadas, materiais de ponto de venda), necessários à operação e à
                comprovação das visitas.
              </li>
              <li>
                <strong className="text-text-primary">Dados técnicos:</strong> tipo de dispositivo, sistema operacional,
                identificadores do aplicativo e logs técnicos para segurança, diagnóstico e melhoria do serviço.
              </li>
              <li>
                <strong className="text-text-primary">Armazenamento local:</strong> o App pode guardar dados no
                dispositivo (por exemplo para funcionamento offline ou desempenho), conforme as funcionalidades
                disponíveis na versão instalada.
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-text-primary">3. Finalidades</h2>
            <p>Utilizamos os dados para:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li>Autenticar usuários e manter a sessão segura;</li>
              <li>Registrar e comprovar visitas comerciais e atividades de promotores;</li>
              <li>Permitir envio e armazenamento de fotos e informações operacionais;</li>
              <li>Cumprir obrigações legais e contratuais aplicáveis ao operador do sistema;</li>
              <li>Proteger o serviço contra uso indevido e garantir a integridade dos registros.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-text-primary">4. Compartilhamento e subprocessadores</h2>
            <p>
              Os dados são processados nos servidores e infraestrutura configurados pelo operador do Promo Gestão. O
              armazenamento de arquivos (como fotos) pode utilizar serviços de nuvem, incluindo{' '}
              <strong className="text-text-primary">Google Firebase / armazenamento em nuvem</strong>, quando assim
              configurado no backend.
            </p>
            <p>
              Não vendemos seus dados pessoais. O compartilhamento limita-se ao necessário para prestar o serviço, por
              obrigação legal ou com seu empregador / organização contratante conforme as regras de acesso definidas no
              sistema.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-text-primary">5. Permissões do dispositivo (Android / iOS)</h2>
            <p>
              O App pode solicitar permissões como câmera, galeria de fotos, localização e armazenamento, conforme as
              funcionalidades. Você pode revogar permissões nas configurações do sistema; algumas funções podem deixar
              de estar disponíveis sem elas.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-text-primary">6. Segurança e retenção</h2>
            <p>
              Adotamos medidas técnicas e organizacionais razoáveis para proteger os dados contra acesso não autorizado,
              perda ou alteração indevida. Os dados são mantidos pelo tempo necessário às finalidades descritas e às
              exigências legais ou contratuais do operador.
            </p>
          </section>

          <section className="space-y-3 rounded-lg border border-dark-border bg-dark-card/50 p-4">
            <h2 className="text-lg font-semibold text-text-primary">7. Público-alvo e menores de 13 anos</h2>
            <p>
              O Promo Gestão é voltado ao uso por <strong className="text-text-primary">profissionais</strong> em
              contexto de trabalho (promotores, supervisores e equipes autorizadas pela empresa).{' '}
              <strong className="text-text-primary">
                Não é direcionado a crianças menores de 13 anos
              </strong>
              , e não coletamos intencionalmente dados de crianças nessa faixa etária.
            </p>
            <p>
              Se você for responsável legal e acreditar que dados de um menor foram enviados ao serviço por engano,
              solicite a exclusão ou retificação entrando em contato pelo canal indicado pelo operador do sistema (seu
              empregador ou suporte da organização).
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-text-primary">8. Seus direitos (LGPD)</h2>
            <p>
              Nos termos da Lei nº 13.709/2018 (LGPD), você pode solicitar confirmação de tratamento, acesso, correção,
              anonimização, portabilidade, eliminação de dados desnecessários ou excessivos, informação sobre
              compartilhamento e revogação do consentimento, quando aplicável.
            </p>
            <p>
              Para exercer direitos, utilize o canal oficial definido pelo <strong className="text-text-primary">operador</strong>{' '}
              (empresa que administra sua conta no Promo Gestão). Podemos solicitar informações para confirmar sua
              identidade antes de atender.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-text-primary">9. Alterações desta política</h2>
            <p>
              Podemos atualizar esta página para refletir mudanças no App ou na legislação. A data da última alteração
              consta no topo deste documento. O uso continuado após a publicação pode significar que você tomou
              conhecimento das mudanças relevantes.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-text-primary">10. Contato</h2>
            <p>
              Para questões sobre privacidade relacionadas ao Promo Gestão, entre em contato com o{' '}
              <strong className="text-text-primary">administrador da sua organização</strong> ou com o suporte indicado
              pelo operador do sistema. Se desejar publicar um e-mail de privacidade institucional nesta página,
              substitua este parágrafo pelo contato oficial da sua empresa.
            </p>
          </section>
        </div>

        <footer className="mt-14 pt-8 border-t border-dark-border text-center text-xs text-text-tertiary">
          <p>© {new Date().getFullYear()} Promo Gestão</p>
        </footer>
      </div>
    </div>
  );
}
