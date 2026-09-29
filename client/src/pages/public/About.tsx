import { Info, Sparkles, Building2, Target, Heart } from 'lucide-react';
import { api } from '../../lib/api';
import { useAsync } from '../../lib/useAsync';
import type { PublicSettings } from '../../lib/types';
import { Spinner } from '../../components/ui';

const DEFAULT = 'NS Physio Clinic provides specialized physiotherapy, rehabilitation, and therapeutic care in a calm, professional environment. \n\nOur primary aim is to help you deeply understand your treatment path and empower you to move with greater comfort, mobility, and confidence. Book your session online in a few simple steps, and our dedicated team will confirm your appointment promptly.';

export default function About() {
  const s = useAsync(() => api<PublicSettings>('/settings'));

  return (
    <div className="relative min-h-screen bg-slate-50/60 font-sans text-slate-800 selection:bg-gold selection:text-white">
      {/* Background Decorative Ambient Lighting */}
      <div className="pointer-events-none absolute -top-40 -right-40 h-[500px] w-[500px] rounded-full bg-gold/5 blur-[120px]" />
      <div className="pointer-events-none absolute bottom-1/4 -left-40 h-[600px] w-[600px] rounded-full bg-blue-500/5 blur-[140px]" />

      <main className="container-x relative z-10 mx-auto max-w-4xl py-16 md:py-24">
        {s.loading ? (
          <div className="flex min-h-[400px] items-center justify-center rounded-3xl border border-slate-100 bg-white p-12 shadow-sm">
            <Spinner />
          </div>
        ) : (
          <div className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-[0_8px_40px_rgba(0,0,0,0.04)]">
            
            {/* Header Area */}
            <div className="relative border-b border-slate-100 bg-slate-50/50 px-8 py-12 text-center md:px-16 md:py-16">
              <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-gold/20 bg-white px-4 py-1.5 shadow-sm">
                <Sparkles className="h-4 w-4 text-gold-dark" />
                <span className="text-xs font-bold uppercase tracking-[0.25em] text-gold-dark">
                  Our Story & Mission
                </span>
              </div>
              
              <h1 className="font-display text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl md:text-5xl">
                About {s.data?.clinic_name ?? 'NS Physio Clinic'}
              </h1>
              <div className="mx-auto mt-6 h-1 w-20 rounded-full bg-gradient-to-r from-gold to-gold-light" />
            </div>

            {/* Content Area */}
            <div className="px-8 py-10 md:px-16 md:py-14">
              <div className="prose prose-slate max-w-none text-base leading-loose text-slate-600 sm:text-lg">
                <p className="whitespace-pre-line">
                  {s.data?.about_text || DEFAULT}
                </p>
              </div>

              {/* Clinic Values/Pillars */}
              <div className="mt-14 grid gap-6 sm:grid-cols-3 border-t border-slate-100 pt-12">
                
                <div className="flex flex-col items-center rounded-2xl bg-slate-50/80 p-6 text-center transition-colors hover:bg-slate-100/80">
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-white shadow-sm text-gold-dark">
                    <Building2 className="h-6 w-6" />
                  </div>
                  <h3 className="font-bold text-slate-900 text-sm">Professional Care</h3>
                  <p className="mt-2 text-xs text-slate-500 leading-relaxed">
                    A calm and safe clinical environment dedicated entirely to your healing journey.
                  </p>
                </div>

                <div className="flex flex-col items-center rounded-2xl bg-slate-50/80 p-6 text-center transition-colors hover:bg-slate-100/80">
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-white shadow-sm text-gold-dark">
                    <Target className="h-6 w-6" />
                  </div>
                  <h3 className="font-bold text-slate-900 text-sm">Targeted Recovery</h3>
                  <p className="mt-2 text-xs text-slate-500 leading-relaxed">
                    Customized therapeutic strategies focusing on precise pain relief and mobility.
                  </p>
                </div>

                <div className="flex flex-col items-center rounded-2xl bg-slate-50/80 p-6 text-center transition-colors hover:bg-slate-100/80">
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-white shadow-sm text-gold-dark">
                    <Heart className="h-6 w-6" />
                  </div>
                  <h3 className="font-bold text-slate-900 text-sm">Patient First</h3>
                  <p className="mt-2 text-xs text-slate-500 leading-relaxed">
                    Empowering you through education to manage symptoms and build long-term strength.
                  </p>
                </div>

              </div>
              
              <div className="mt-12 text-center pb-2">
                <p className="text-xs font-bold uppercase tracking-[0.3em] text-slate-400">
                  Move Better <span className="mx-2 text-gold/50">•</span> Feel Better <span className="mx-2 text-gold/50">•</span> Live Better
                </p>
              </div>

            </div>
          </div>
        )}
      </main>
    </div>
  );
}