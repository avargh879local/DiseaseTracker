import Dashboard from '@/app/components/Dashboard';
import { fetchAllSignals } from '@/lib/signals';
import { SignalsResponse } from '@/app/types';

export default async function HomePage() {
  let initialData: SignalsResponse | null = null;
  try {
    initialData = await fetchAllSignals();
  } catch (e) {
    console.error('[SENTINEL] Server-side prefetch failed:', e);
  }
  return <Dashboard initialData={initialData} />;
}
