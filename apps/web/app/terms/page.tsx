import { InfoPage } from '../../src/components/info-page';

export const metadata = { title: 'Terms of Service — Dokane' };

export default function TermsPage() {
  return (
    <InfoPage title="Terms of Service">
      <p><b className="text-ink">Draft — pilot.</b> These terms are being finalised for launch. By using Dokane during the pilot you agree to use it in good faith for evaluating the platform.</p>
      <p>Your business data belongs to you. We process it only to operate the service. The platform is provided “as is” during the pilot, without warranties, while we build toward general availability.</p>
      <p>Questions? Email <a className="text-brand" href="mailto:support@dokane.test">support@dokane.test</a>.</p>
    </InfoPage>
  );
}
