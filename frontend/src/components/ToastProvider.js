'use client';

import useToastStore from '@/store/useToastStore';

export default function ToastProvider() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);
  const confirm = useToastStore((s) => s.confirm);

  return (
    <>
      <div className="fixed top-20 right-4 z-[80] flex flex-col gap-2 max-w-sm w-[calc(100%-2rem)] pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto animate-slide-left shadow-xl rounded-2xl px-4 py-3 border flex items-start gap-3 ${
              t.type === 'success'
                ? 'bg-white border-green-200 text-green-800'
                : t.type === 'error'
                ? 'bg-white border-red-200 text-red-700'
                : 'bg-white border-primary-200 text-primary-800'
            }`}
          >
            <span className="text-lg leading-none mt-0.5">
              {t.type === 'success' ? '✓' : t.type === 'error' ? '!' : 'i'}
            </span>
            <p className="text-sm font-semibold flex-1 leading-snug">{t.message}</p>
            <button
              onClick={() => dismiss(t.id)}
              className="text-gray-400 hover:text-gray-600 text-sm font-bold px-1"
              aria-label="Cerrar"
            >
              ×
            </button>
          </div>
        ))}
      </div>

      {confirm && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => confirm.resolve(false)}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-scale-in border border-gray-100">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 ${
              confirm.danger ? 'bg-red-50 text-red-600' : 'bg-primary-50 text-primary-700'
            }`}>
              {confirm.danger ? (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z"
                  />
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              )}
            </div>
            <h3 className="text-lg font-black text-gray-900">{confirm.title}</h3>
            <p className="text-sm text-gray-500 mt-2 leading-relaxed">{confirm.message}</p>
            <div className="flex gap-2 mt-6">
              <button
                onClick={() => confirm.resolve(false)}
                className="btn-outline flex-1 text-sm py-2.5"
              >
                {confirm.cancelLabel}
              </button>
              <button
                onClick={() => confirm.resolve(true)}
                className={`flex-1 text-sm py-2.5 rounded-xl font-semibold text-white transition-all active:scale-[0.98] ${
                  confirm.danger
                    ? 'bg-red-500 hover:bg-red-600 shadow-md shadow-red-200'
                    : 'btn-primary'
                }`}
              >
                {confirm.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
