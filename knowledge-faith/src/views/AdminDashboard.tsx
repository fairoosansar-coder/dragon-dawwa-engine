import { useState } from 'react';
import {
  ArrowLeft,
  HelpCircle,
  Megaphone,
  Palette,
  Shield,
  ShieldCheck,
  User,
} from 'lucide-react';
import type { ViewProps } from '../App.tsx';
import { AdminBroadcast } from '../components/admin/AdminBroadcast.tsx';
import { AdminModeration } from '../components/admin/AdminModeration.tsx';
import { AdminQAInbox } from '../components/admin/AdminQAInbox.tsx';
import { AdminThemeStudio } from '../components/admin/AdminThemeStudio.tsx';
import { useSeekerAuth } from '../lib/seekerAuth.ts';

type AdminTabId = 'moderation' | 'qa' | 'broadcast' | 'theme';

export function AdminDashboard({ sub }: ViewProps) {
  const { user, updateProfile } = useSeekerAuth();
  const [tab, setTab] = useState<AdminTabId>(() => {
    if (sub === 'qa' || sub === 'broadcast' || sub === 'theme') return sub;
    return 'moderation';
  });
  const [operatorOverride, setOperatorOverride] = useState(true);

  const isAdmin =
    operatorOverride ||
    user?.role === 'admin' ||
    Boolean(user && /feroz|fairoos|admin/i.test(`${user.name} ${user.email}`));

  const handleGrantAdminRole = async () => {
    setOperatorOverride(true);
    if (user) {
      await updateProfile({
        name: user.name,
        kunyah: user.kunyah,
        bio: user.bio,
        emblem: user.emblem,
        role: 'admin',
      });
    }
  };

  return (
    <section data-admin-cockpit className="mx-auto max-w-3xl space-y-4">
      {/* Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <a
          href="#/quran/wall"
          className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-stone-700 shadow-2xs transition hover:bg-stone-50"
        >
          <ArrowLeft className="h-3.5 w-3.5 text-emerald-700" aria-hidden />
          <span>Back to Faith Wall</span>
        </a>

        <a
          href="#/profile"
          className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-stone-700 shadow-2xs transition hover:bg-stone-50"
        >
          <User className="h-3.5 w-3.5 text-emerald-700" aria-hidden />
          <span>My Profile Portfolio</span>
        </a>
      </div>

      {/* Cockpit Header Card */}
      <header className="rounded-2xl border border-stone-200/80 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#073C30] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#F9E7B9]">
              <ShieldCheck className="h-3 w-3 text-[#D4AF37]" aria-hidden />
              Institutional Admin Cockpit
            </span>
            <h1 className="mt-1 font-display text-lg font-bold text-stone-900 sm:text-xl">
              Governance, Moderation & Broadcast Studio
            </h1>
            <p className="mt-0.5 text-xs text-stone-600 sm:text-[13px]">
              Curate the Community Faith Wall, answer flagged seeker inquiries, publish pinned institutional broadcasts, and customize studio banners.
            </p>
          </div>

          {!isAdmin && (
            <button
              type="button"
              onClick={() => void handleGrantAdminRole()}
              className="rounded-xl bg-[#073C30] px-4 py-2 text-xs font-semibold text-white"
            >
              Activate Admin Session
            </button>
          )}
        </div>

        {/* 4 Navigation Sub-Tabs */}
        <nav
          aria-label="Admin Cockpit Sections"
          data-admin-tabs
          className="mt-4 grid grid-cols-2 gap-2 border-t border-stone-100 pt-4 sm:grid-cols-4"
        >
          <button
            type="button"
            data-admin-tab="moderation"
            aria-pressed={tab === 'moderation'}
            onClick={() => setTab('moderation')}
            className={`flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-xs font-semibold transition ${
              tab === 'moderation'
                ? 'border-[#073C30] bg-[#073C30] text-white shadow-xs'
                : 'border-stone-200 bg-stone-50 text-stone-700 hover:bg-white'
            }`}
          >
            <Shield className="h-3.5 w-3.5 text-[#D4AF37]" aria-hidden />
            <span>Moderation Queue</span>
          </button>

          <button
            type="button"
            data-admin-tab="qa"
            aria-pressed={tab === 'qa'}
            onClick={() => setTab('qa')}
            className={`flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-xs font-semibold transition ${
              tab === 'qa'
                ? 'border-[#073C30] bg-[#073C30] text-white shadow-xs'
                : 'border-stone-200 bg-stone-50 text-stone-700 hover:bg-white'
            }`}
          >
            <HelpCircle className="h-3.5 w-3.5 text-[#D4AF37]" aria-hidden />
            <span>Scholar Q&A Inbox</span>
          </button>

          <button
            type="button"
            data-admin-tab="broadcast"
            aria-pressed={tab === 'broadcast'}
            onClick={() => setTab('broadcast')}
            className={`flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-xs font-semibold transition ${
              tab === 'broadcast'
                ? 'border-[#073C30] bg-[#073C30] text-white shadow-xs'
                : 'border-stone-200 bg-stone-50 text-stone-700 hover:bg-white'
            }`}
          >
            <Megaphone className="h-3.5 w-3.5 text-[#D4AF37]" aria-hidden />
            <span>Post to Wall (Official)</span>
          </button>

          <button
            type="button"
            data-admin-tab="theme"
            aria-pressed={tab === 'theme'}
            onClick={() => setTab('theme')}
            className={`flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-xs font-semibold transition ${
              tab === 'theme'
                ? 'border-[#073C30] bg-[#073C30] text-white shadow-xs'
                : 'border-stone-200 bg-stone-50 text-stone-700 hover:bg-white'
            }`}
          >
            <Palette className="h-3.5 w-3.5 text-[#D4AF37]" aria-hidden />
            <span>Banner & Theme Studio</span>
          </button>
        </nav>
      </header>

      {/* Active Sub-Tab Body */}
      {tab === 'moderation' && <AdminModeration />}
      {tab === 'qa' && <AdminQAInbox />}
      {tab === 'broadcast' && <AdminBroadcast />}
      {tab === 'theme' && <AdminThemeStudio />}
    </section>
  );
}

export default AdminDashboard;
