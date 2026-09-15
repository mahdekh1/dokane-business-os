import { InfoPage } from '../../src/components/info-page';

export const metadata = { title: 'Privacy Policy — Dokane' };

export default function PrivacyPage() {
  return (
    <InfoPage title="Privacy Policy">
      <p><b className="text-ink">Draft — pilot.</b> This policy is being finalised for launch.</p>
      <p>We collect the account and business details you provide to run your workspace (name, email, phone, and what you configure). We use them only to operate Dokane and never sell them.</p>
      <p>You can request a copy or deletion of your data at any time by emailing <a className="text-brand" href="mailto:support@dokane.test">support@dokane.test</a>.</p>
    </InfoPage>
  );
}
