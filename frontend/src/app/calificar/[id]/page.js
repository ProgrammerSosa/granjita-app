'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { fetchRatingInfo, submitRating } from '@/lib/api';
import BrandLogo from '@/components/BrandLogo';

const STAR_LABELS = ['', 'Malo', 'Regular', 'Bueno', 'Muy bueno', '¡Excelente!'];

function Stars({ value, onChange, readOnly = false, size = 'text-5xl' }) {
  const [hover, setHover] = useState(0);
  const shown = hover || value;
  return (
    <div className="flex items-center justify-center gap-1.5" onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={readOnly}
          onClick={() => onChange?.(n)}
          onMouseEnter={() => !readOnly && setHover(n)}
          className={`${size} leading-none transition-transform ${
            readOnly ? 'cursor-default' : 'hover:scale-110 active:scale-95'
          }`}
          aria-label={`${n} estrella${n > 1 ? 's' : ''}`}
        >
          <span className={n <= shown ? 'text-primary-500' : 'text-admin-300'}>★</span>
        </button>
      ))}
    </div>
  );
}

export default function CalificarPage() {
  const { id } = useParams();
  const searchParams = useSearchParams();
  const token = searchParams.get('t');

  const [loading, setLoading] = useState(true);
  const [info, setInfo] = useState(null);
  const [error, setError] = useState('');
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('Link inválido o incompleto.');
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const data = await fetchRatingInfo(id, token);
        setInfo(data);
        if (data.alreadyRated) {
          setStars(data.stars || 0);
          setComment(data.comment || '');
          setDone(true);
        }
      } catch {
        setError('No encontramos este pedido. Puede que el link haya expirado.');
      } finally {
        setLoading(false);
      }
    })();
  }, [id, token]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!stars) return;
    setSaving(true);
    try {
      await submitRating(id, token, { stars, comment: comment.trim() });
      setDone(true);
    } catch (err) {
      setError(err.message || 'No se pudo guardar tu calificación.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center text-center mb-6">
          <BrandLogo size={64} rounded="rounded-2xl" />
          <h1 className="text-2xl font-black text-ink-900 mt-3">La Granjita</h1>
          <p className="text-sm text-primary-600 font-semibold uppercase tracking-wider">
            De la granja a tu puerta
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-10 h-10 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : error ? (
          <div className="bg-white rounded-3xl shadow-card p-8 text-center">
            <p className="text-4xl mb-3">🙈</p>
            <p className="text-ink-700 font-semibold">{error}</p>
          </div>
        ) : done ? (
          <div className="bg-white rounded-3xl shadow-card p-8 text-center animate-fade-in">
            <p className="text-5xl mb-3">💛</p>
            <h2 className="text-xl font-black text-ink-900">¡Gracias por calificarnos!</h2>
            <p className="text-sm text-ink-500 mt-1">Tu opinión nos ayuda a mejorar.</p>
            <div className="my-5">
              <Stars value={stars} readOnly size="text-4xl" />
              <p className="text-sm font-bold text-primary-600 mt-1">{STAR_LABELS[stars]}</p>
            </div>
            {comment && (
              <p className="text-sm text-ink-600 italic bg-cream-50 rounded-2xl p-3 border border-cream-200">
                “{comment}”
              </p>
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-white rounded-3xl shadow-card p-7 space-y-5">
            <div className="text-center">
              <h2 className="text-lg font-black text-ink-900">
                {info?.customerName ? `¡Hola, ${info.customerName}!` : '¡Hola!'}
              </h2>
              <p className="text-sm text-ink-500 mt-1">
                ¿Cómo estuvo tu pedido{info?.code ? ` #${info.code}` : ''}?
              </p>
            </div>

            <div>
              <Stars value={stars} onChange={setStars} />
              <p className="text-center text-sm font-bold text-primary-600 mt-2 h-5">
                {STAR_LABELS[stars]}
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-ink-500 uppercase tracking-wide mb-1.5">
                Comentario (opcional)
              </label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
                maxLength={500}
                placeholder="Contanos qué te pareció, qué podemos mejorar…"
                className="w-full px-4 py-3 rounded-2xl border border-ink-200 text-sm outline-none focus:border-primary-500 resize-none"
              />
            </div>

            <button
              type="submit"
              disabled={!stars || saving}
              className="w-full py-3.5 rounded-2xl font-black text-ink-950 bg-primary-500 hover:bg-primary-400 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
            >
              {saving ? 'Enviando…' : 'Enviar calificación'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
