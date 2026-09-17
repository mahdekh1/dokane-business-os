'use client';

import { useParams } from 'next/navigation';
import { OfferingForm } from '../../../../../src/components/catalog/offering-form';

export default function EditOfferingPage() {
  const { id } = useParams<{ id: string }>();
  return <OfferingForm id={id} />;
}
