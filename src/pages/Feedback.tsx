import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Loader2, MessageSquareText, Sparkles, Star } from 'lucide-react';
import type { Product } from '../types';
import {
  subscribeToVendorTryOnFeedback,
  type VendorTryOnFeedback
} from '../services/VendorFeedbackService';

interface FeedbackProps {
  vendorId?: string;
  products: Product[];
}

const formatDate = (date: Date | null) => date
  ? date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
  : 'Date unavailable';

function RatingStars({ rating }: { rating: number }) {
  return (
    <span className="inline-flex items-center gap-1" aria-label={`${rating} out of 5 stars`}>
      {Array.from({ length: 5 }, (_, index) => (
        <Star
          key={index}
          className={`h-4 w-4 ${index < rating ? 'fill-amber-400 text-amber-400' : 'text-slate-200'}`}
        />
      ))}
    </span>
  );
}

export default function Feedback({ vendorId = '', products }: FeedbackProps) {
  const [feedback, setFeedback] = useState<VendorTryOnFeedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    const unsubscribe = subscribeToVendorTryOnFeedback(
      vendorId,
      products,
      updatedFeedback => {
        setFeedback(updatedFeedback);
        setLoading(false);
      },
      err => {
        console.error('Failed to subscribe to vendor try-on feedback', err);
        setError(err.message);
        setLoading(false);
      }
    );
    return unsubscribe;
  }, [vendorId, products]);

  const averageRating = useMemo(() => {
    if (!feedback.length) {
      return '0.0';
    }
    return (feedback.reduce((sum, item) => sum + item.rating, 0) / feedback.length).toFixed(1);
  }, [feedback]);

  return (
    <section className="space-y-6">
      <header>
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-primary/10 p-3 text-primary">
            <Sparkles className="h-6 w-6" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-extrabold text-slate-900">Try-On Feedback</h1>
            <p className="mt-1 text-sm text-slate-500">See what NOVA customers think about the fit of your products.</p>
          </div>
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-slate-500">Average try-on rating</p>
          <div className="mt-3 flex items-center gap-3">
            <span className="font-display text-3xl font-extrabold text-slate-900">{averageRating}</span>
            <RatingStars rating={Math.round(Number(averageRating))} />
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-slate-500">Customer reviews</p>
          <div className="mt-3 flex items-center gap-3">
            <MessageSquareText className="h-6 w-6 text-primary" />
            <span className="font-display text-3xl font-extrabold text-slate-900">{feedback.length}</span>
          </div>
        </div>
      </div>

      {error && (
        <div role="alert" className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          <p>Could not load try-on feedback: {error}</p>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200/70 bg-white p-12 text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Loading feedback…</span>
        </div>
      ) : !feedback.length ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <MessageSquareText className="mx-auto h-8 w-8 text-slate-400" />
          <h2 className="mt-3 font-display text-lg font-bold text-slate-800">No try-on feedback yet</h2>
          <p className="mt-1 text-sm text-slate-500">Customer ratings and fit comments will appear here when submitted.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {feedback.map(item => (
            <article key={item.id} className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-display font-bold text-slate-900">{item.productName || 'Your product'}</h2>
                  <p className="mt-1 text-sm text-slate-500">{item.customerName}{item.color ? ` · ${item.color}` : ''}</p>
                </div>
                <div className="flex flex-col items-start gap-1 sm:items-end">
                  <RatingStars rating={item.rating} />
                  <time className="text-xs text-slate-400">{formatDate(item.createdAt)}</time>
                </div>
              </div>
              {item.comment && <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-slate-700">{item.comment}</p>}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
