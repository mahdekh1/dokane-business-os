import { InfoPage } from '../../src/components/info-page';

export const metadata = { title: 'Reset password — Dokane' };

export default function ForgotPage() {
  return (
    <InfoPage title="Reset your password">
      <p>Self-service password reset isn’t available during the pilot yet.</p>
      <p>To reset your password, email <a className="text-brand" href="mailto:support@dokane.test">support@dokane.test</a> from the address on your account and we’ll help you back in.</p>
    </InfoPage>
  );
}
