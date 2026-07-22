'use client';
import NotificationCenter from '@/components/NotificationCenter';

export default function ZZ() {
  return (
    <div className="min-h-screen bg-ink-900 p-10 flex justify-end">
      <div className="bg-ink-800 rounded-xl p-2 text-white" id="host">
        <NotificationCenter />
      </div>
    </div>
  );
}
