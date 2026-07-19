'use client';

export function ConfirmModal({ open, title, message, confirmText = 'Confirmar', cancelText = 'Cancelar', onConfirm, onCancel, danger = false }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="bg-white w-full max-w-sm mx-4 rounded-2xl shadow-2xl overflow-hidden animate-slide-up">
        <div className="p-6 text-center">
          <div className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 ${danger ? 'bg-red-100' : 'bg-gray-100'}`}>
            {danger ? (
              <svg className="w-7 h-7 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            ) : (
              <svg className="w-7 h-7 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-1">{title}</h3>
          <p className="text-sm text-gray-500 leading-relaxed">{message}</p>
        </div>
        <div className="flex border-t border-gray-100">
          <button onClick={onCancel} className="flex-1 py-3.5 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
            {cancelText}
          </button>
          <div className="w-px bg-gray-100" />
          <button onClick={onConfirm} className={`flex-1 py-3.5 text-sm font-semibold transition-colors ${danger ? 'text-red-600 hover:bg-red-50' : 'text-orange-600 hover:bg-orange-50'}`}>
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

export function AlertModal({ open, title, message, buttonText = 'Entendido', type = 'error', onClose }) {
  if (!open) return null;

  const colors = {
    error: { bg: 'bg-red-100', icon: 'text-red-500', btn: 'text-red-600 hover:bg-red-50' },
    success: { bg: 'bg-green-100', icon: 'text-green-500', btn: 'text-green-600 hover:bg-green-50' },
    info: { bg: 'bg-blue-100', icon: 'text-blue-500', btn: 'text-blue-600 hover:bg-blue-50' },
  };
  const c = colors[type] || colors.error;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-white w-full max-w-sm mx-4 rounded-2xl shadow-2xl overflow-hidden animate-slide-up">
        <div className="p-6 text-center">
          <div className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 ${c.bg}`}>
            {type === 'error' && (
              <svg className={`w-7 h-7 ${c.icon}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            )}
            {type === 'success' && (
              <svg className={`w-7 h-7 ${c.icon}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
            {type === 'info' && (
              <svg className={`w-7 h-7 ${c.icon}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-1">{title}</h3>
          <p className="text-sm text-gray-500 leading-relaxed">{message}</p>
        </div>
        <div className="border-t border-gray-100">
          <button onClick={onClose} className={`w-full py-3.5 text-sm font-semibold transition-colors ${c.btn}`}>
            {buttonText}
          </button>
        </div>
      </div>
    </div>
  );
}
