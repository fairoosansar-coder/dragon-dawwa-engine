import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Check, Copy, HelpCircle, LogIn, LogOut, ShieldCheck, Sparkles, User, X } from 'lucide-react';
import { RubElHizb } from '../engine/ds/ornaments.tsx';
import {
  buildGoogleOAuthRedirectUrl,
  ensureGoogleGisLoaded,
  SEEKER_EMBLEMS,
  useSeekerAuth,
  type SeekerAuthProvider,
  type SeekerEmblem,
} from '../lib/seekerAuth.ts';
import { listFaithWallPosts } from '../lib/verseShare.ts';

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: {
          initialize: (config: {
            client_id: string;
            ux_mode?: 'popup' | 'redirect';
            auto_select?: boolean;
            itp_support?: boolean;
            callback: (response: { credential?: string }) => void;
          }) => void;
          renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void;
          prompt: (momentListener?: (notification: {
            isNotDisplayed?: () => boolean;
            isSkippedMoment?: () => boolean;
          }) => void) => void;
        };
      };
    };
  }
}

export function GoogleGMark({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden className="shrink-0">
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v2.98h3.86c2.26-2.09 3.56-5.17 3.56-8.8Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-2.98c-1.08.72-2.45 1.16-4.07 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.31A7.19 7.19 0 0 1 4.9 12c0-.81.14-1.59.38-2.31V6.6H1.29A11.99 11.99 0 0 0 0 12c0 1.93.46 3.77 1.29 5.4l3.99-3.09Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.6l3.99 3.09c.95-2.85 3.6-4.94 6.72-4.94Z"
      />
    </svg>
  );
}

export function SeekerEmblemGlyph({
  emblem = 'rub-el-hizb',
  size = 18,
}: {
  emblem?: SeekerEmblem;
  size?: number;
}) {
  if (emblem === 'crescent-star') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M15.5 3.8a8.5 8.5 0 1 0 4.7 14.9 7.2 7.2 0 0 1-4.7-14.9Z"
          stroke="#D4AF37"
          strokeWidth="1.6"
          fill="rgba(212,175,55,0.22)"
        />
        <polygon
          points="17.5,6 18.2,7.8 20,8 18.6,9.2 19,11 17.5,10 16,11 16.4,9.2 15,8 16.8,7.8"
          fill="#D4AF37"
        />
      </svg>
    );
  }
  if (emblem === 'octagon-rosette') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
        <rect x="5" y="5" width="14" height="14" stroke="#D4AF37" strokeWidth="1.5" fill="rgba(212,175,55,0.14)" />
        <rect
          x="5"
          y="5"
          width="14"
          height="14"
          transform="rotate(45 12 12)"
          stroke="#D4AF37"
          strokeWidth="1.5"
          fill="rgba(212,175,55,0.14)"
        />
        <circle cx="12" cy="12" r="2.6" fill="#D4AF37" />
      </svg>
    );
  }
  if (emblem === 'emerald-lamp') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M12 3v3M8 6h8l2 5c0 3.3-2.7 6-6 6s-6-2.7-6-6l2-5ZM9.5 20h5"
          stroke="#D4AF37"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="12" cy="11" r="2.2" fill="#D4AF37" />
      </svg>
    );
  }
  return <RubElHizb size={size} />;
}

export function SeekerAvatar({
  avatarUrl,
  name,
  emblem = 'rub-el-hizb',
  size = 18,
}: {
  avatarUrl?: string | null;
  name?: string;
  emblem?: SeekerEmblem;
  size?: number;
}) {
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    setImgFailed(false);
  }, [avatarUrl]);

  if (avatarUrl && !imgFailed) {
    return (
      <img
        src={avatarUrl}
        alt={name || 'Seeker avatar'}
        referrerPolicy="no-referrer"
        onError={() => setImgFailed(true)}
        className="h-full w-full rounded-[inherit] object-cover"
      />
    );
  }

  return <SeekerEmblemGlyph emblem={emblem} size={size} />;
}

export function SeekerAccountPill({ variant = 'sidebar' }: { variant?: 'sidebar' | 'header' }) {
  const { user, openModal } = useSeekerAuth();

  if (variant === 'header') {
    return (
      <button
        type="button"
        data-header-account-pill
        onClick={() => openModal()}
        className="inline-flex items-center gap-2 rounded-full border border-[#D4AF37]/55 bg-[#073C30] px-3 py-1.5 text-xs font-semibold text-[#F5EEDC] shadow-sm transition hover:border-[#D4AF37] hover:bg-[#0A2E23]"
      >
        <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#D4AF37]/45 bg-[#031812]">
          {user ? (
            <SeekerAvatar avatarUrl={user.avatarUrl} name={user.name} emblem={user.emblem} size={13} />
          ) : (
            <LogIn className="h-3 w-3 text-[#D4AF37]" aria-hidden />
          )}
        </span>
        <span className="max-w-[7.5rem] truncate">{user ? user.name : 'Sign in'}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      data-seeker-account-pill
      onClick={() => openModal()}
      className="mb-2 flex w-full items-center gap-2.5 rounded-2xl border border-[#C6A15A]/45 bg-[#04241C] px-3 py-2.5 text-left text-[#F5EEDC] shadow-sm transition hover:border-[#D4AF37] hover:bg-[#0A2E23]"
    >
      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[#D4AF37]/45 bg-[#073C30]">
        {user ? (
          <SeekerAvatar avatarUrl={user.avatarUrl} name={user.name} emblem={user.emblem} size={18} />
        ) : (
          <User className="h-4 w-4 text-[#D4AF37]" aria-hidden />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="truncate text-xs font-semibold text-[#F9E7B9]">
            {user ? user.name : 'Sign in · My Wall'}
          </p>
          {user?.verified && <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-[#D4AF37]" aria-hidden />}
        </div>
        <p className="truncate text-[11px] text-[#F5EEDC]/70">
          {user ? user.kunyah : 'Personal Faith Wall & Session'}
        </p>
      </div>
    </button>
  );
}

export function SeekerAuthModal() {
  const {
    user,
    googleAuth,
    modalOpen,
    pendingDesk,
    closeModal,
    loginOrRegister,
    signInWithGoogleCredential,
    updateProfile,
    signOut,
  } = useSeekerAuth();
  const [tab, setTab] = useState<'signin' | 'register'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [kunyah, setKunyah] = useState('Seeker of Knowledge');
  const [bio, setBio] = useState('');
  const [emblem, setEmblem] = useState<SeekerEmblem>('rub-el-hizb');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusNote, setStatusNote] = useState<string | null>(null);
  const [showOAuthSetupHelp, setShowOAuthSetupHelp] = useState(false);
  const [copiedUri, setCopiedUri] = useState<string | null>(null);
  const gisContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (user) {
      setName(user.name);
      setKunyah(user.kunyah);
      setBio(user.bio || '');
      setEmblem(user.emblem);
    }
    setError(null);
    setStatusNote(null);
    if (typeof window !== 'undefined' && window.location.href.includes('auth_error=')) {
      setShowOAuthSetupHelp(true);
    }
  }, [user, modalOpen]);

  useEffect(() => {
    if (!modalOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeModal();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [modalOpen, closeModal]);

  useEffect(() => {
    if (!modalOpen || user || !googleAuth.enabled || !googleAuth.clientId) return;
    let active = true;
    void ensureGoogleGisLoaded().then(loaded => {
      if (!active || !loaded) return;
      const gId = window.google?.accounts?.id;
      const slot = gisContainerRef.current;
      if (!gId || !slot) return;
      try {
        gId.initialize({
          client_id: googleAuth.clientId!,
          ux_mode: 'popup',
          itp_support: true,
          callback: response => {
            if (!response.credential) return;
            setBusy(true);
            setError(null);
            void signInWithGoogleCredential(response.credential)
              .then(() => {
                setStatusNote('Signed in with Google to your Personal Faith Wall.');
              })
              .catch((err: unknown) => {
                setError(err instanceof Error ? err.message : 'Google Sign-In failed.');
              })
              .finally(() => setBusy(false));
          },
        });
        slot.innerHTML = '';
        gId.renderButton(slot, {
          type: 'standard',
          theme: 'filled_black',
          size: 'large',
          shape: 'pill',
          text: 'continue_with',
          width: 380,
        });
      } catch {
        /* ignore GIS script initialization errors */
      }
    });
    return () => {
      active = false;
    };
  }, [modalOpen, user, googleAuth.enabled, googleAuth.clientId, signInWithGoogleCredential]);

  if (!modalOpen) return null;

  const myPosts = user
    ? listFaithWallPosts().filter(post => post.userId === user.id || post.authorName === user.name)
    : [];
  const totalAmeen = myPosts.reduce((sum, post) => sum + (post.likes ?? 1), 0);
  const isGoogleUser = Boolean(user && (user.authProvider === 'google' || user.provider === 'google'));

  const currentOrigin =
    typeof window !== 'undefined' && window.location.origin
      ? window.location.origin
      : 'https://dragon-dawwa-production.up.railway.app';
  const expectedRedirectUri = googleAuth.redirectUriOverride || `${currentOrigin}${googleAuth.callbackPath || '/api/auth/google/callback'}`;

  const copyUri = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedUri(label);
      window.setTimeout(() => setCopiedUri(current => (current === label ? null : current)), 2200);
    } catch {
      /* ignore */
    }
  };

  const handleQuickAuth = async (provider: SeekerAuthProvider) => {
    setBusy(true);
    setError(null);
    setStatusNote(null);
    try {
      const defaultProfiles: Record<SeekerAuthProvider, { email: string; name: string; kunyah: string }> = {
        google: {
          email: email.trim() || 'fairoos.seeker@gmail.com',
          name: name.trim() || 'Brother Feroz Ansar',
          kunyah: kunyah.trim() || 'Verified Google Seeker',
        },
        apple: {
          email: email.trim() || 'seeker.icloud@apple.com',
          name: name.trim() || 'Sister Layla Mansoor',
          kunyah: kunyah.trim() || 'Student of Qur’anic Tafsir',
        },
        guest: {
          email: email.trim() || 'seeker.pass@dragondawwa.com',
          name: name.trim() || 'Ustadh Zayd al-Ansari',
          kunyah: kunyah.trim() || 'Seeker of Knowledge',
        },
        email: {
          email: email.trim(),
          name: name.trim(),
          kunyah: kunyah.trim(),
        },
      };
      const chosen = defaultProfiles[provider];
      await loginOrRegister({
        mode: 'quick',
        provider,
        email: chosen.email,
        name: chosen.name,
        kunyah: chosen.kunyah,
        bio,
        emblem,
      });
      setStatusNote('Signed in to your Personal Faith Wall session.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sign in.');
    } finally {
      setBusy(false);
    }
  };

  const handleContinueWithGoogle = async () => {
    if (googleAuth.enabled && googleAuth.clientId) {
      const loaded = await ensureGoogleGisLoaded();
      const gId = window.google?.accounts?.id;
      if (loaded && gId) {
        const gisBtn = gisContainerRef.current?.querySelector<HTMLElement>('[role="button"], div[ tabindex="0" ]');
        if (gisBtn) {
          gisBtn.click();
          return;
        }
        gId.prompt(notification => {
          if (notification.isNotDisplayed?.() || notification.isSkippedMoment?.()) {
            void handleQuickAuth('google');
          }
        });
        return;
      }
    }
    await handleQuickAuth('google');
  };

  const handleOAuthRedirectStart = (callbackPath?: string) => {
    if (typeof window === 'undefined') return;
    window.location.href = buildGoogleOAuthRedirectUrl(window.location.hash || '#/quran/wall', callbackPath);
  };

  const handleFormSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setStatusNote(null);
    try {
      await loginOrRegister({
        mode: tab === 'register' ? 'register' : 'login',
        provider: 'email',
        email,
        password,
        name,
        kunyah,
        bio,
        emblem,
      });
      setStatusNote(
        tab === 'register'
          ? 'Your Seeker account and Personal Faith Wall are ready!'
          : 'Welcome back to your Personal Faith Wall!',
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleProfileSave = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setStatusNote(null);
    try {
      await updateProfile({ name, kunyah, bio, emblem });
      setStatusNote('Personal Faith Wall profile updated!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update profile.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Seeker Account & Personal Faith Wall Session"
      data-seeker-auth-modal
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-3 backdrop-blur-md sm:p-6"
      onClick={closeModal}
    >
      <div
        style={{
          background: 'linear-gradient(145deg, #031812 0%, #073024 55%, #041812 100%)',
        }}
        className="relative max-h-[92dvh] w-full max-w-xl overflow-y-auto rounded-3xl border-2 border-[#D4AF37]/50 p-5 text-[#F5EEDC] shadow-2xl sm:p-7"
        onClick={event => event.stopPropagation()}
      >
        {/* Inner Gold Frame */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-2.5 rounded-2xl border border-[#D4AF37]/20"
        />

        {/* Header */}
        <div className="relative z-10 flex items-start justify-between gap-3">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#D4AF37]/50 bg-[#D4AF37]/15 px-3 py-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#D4AF37]">
              <Sparkles className="h-3 w-3" aria-hidden />
              DRAGON DAWWA · SEEKER SESSION
            </span>
            <h2 className="mt-2 font-display text-xl font-bold text-white sm:text-2xl">
              {user
                ? 'Your Seeker Profile & Personal Wall'
                : pendingDesk
                  ? `Sign in to Enter ${pendingDesk}`
                  : 'Sign in to Your Personal Faith Wall'}
            </h2>
            <p data-auth-modal-subtitle className="mt-1 text-xs leading-relaxed text-[#F5EEDC]/75 sm:text-sm">
              {user
                ? 'Manage your verified Seeker identity, kunyah, emblem, and personal Qur’anic reflections.'
                : pendingDesk
                  ? `Sign in to enter ${pendingDesk} and access Dragon Dawwa’s full research studio.`
                  : 'Publish illuminated 16:9 verse cards under your verified name and curate your Personal Faith Wall.'}
            </p>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={closeModal}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#D4AF37]/35 bg-white/5 text-[#F5EEDC] transition hover:border-[#D4AF37] hover:bg-white/10"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        {user ? (
          <form onSubmit={event => void handleProfileSave(event)} className="relative z-10 mt-5 space-y-4">
            {/* Active Session Identity Banner */}
            <div
              data-seeker-active-card
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#D4AF37]/45 bg-[#031812]/85 p-4"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-[#D4AF37]/55 bg-[#0A2E23]">
                  <SeekerAvatar avatarUrl={user.avatarUrl} name={user.name} emblem={emblem} size={24} />
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <p className="truncate font-display text-base font-bold text-white">{user.name}</p>
                    <span className="inline-flex items-center gap-1 rounded-full border border-[#D4AF37]/50 bg-[#D4AF37]/15 px-2 py-0.5 text-[10px] font-semibold text-[#D4AF37]">
                      <ShieldCheck className="h-3 w-3" aria-hidden />
                      {isGoogleUser ? 'Verified Google Seeker' : 'Verified Seeker'}
                    </span>
                  </div>
                  <p className="truncate text-xs text-[#D4AF37]/90">{user.kunyah}</p>
                  <p className="truncate text-[11px] text-[#F5EEDC]/60">{user.email}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 text-center">
                <div className="rounded-xl border border-[#D4AF37]/25 bg-[#0A2E23]/70 px-3 py-1.5">
                  <p className="font-display text-base font-bold text-[#D4AF37]">{myPosts.length}</p>
                  <p className="text-[10px] uppercase tracking-wider text-[#F5EEDC]/70">My Cards</p>
                </div>
                <div className="rounded-xl border border-[#D4AF37]/25 bg-[#0A2E23]/70 px-3 py-1.5">
                  <p className="font-display text-base font-bold text-[#D4AF37]">{totalAmeen}</p>
                  <p className="text-[10px] uppercase tracking-wider text-[#F5EEDC]/70">Ameen</p>
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-xs font-medium text-[#F5EEDC]/85">
                Display Name
                <input
                  type="text"
                  data-auth-name-input
                  value={name}
                  onChange={event => setName(event.target.value)}
                  required
                  className="mt-1.5 w-full rounded-xl border border-[#D4AF37]/35 bg-[#031812]/90 px-3.5 py-2 text-sm text-white focus:border-[#D4AF37] focus:outline-none"
                />
              </label>

              <label className="block text-xs font-medium text-[#F5EEDC]/85">
                Kunyah / Scholarly Role
                <input
                  type="text"
                  data-auth-kunyah-input
                  value={kunyah}
                  onChange={event => setKunyah(event.target.value)}
                  required
                  className="mt-1.5 w-full rounded-xl border border-[#D4AF37]/35 bg-[#031812]/90 px-3.5 py-2 text-sm text-white focus:border-[#D4AF37] focus:outline-none"
                />
              </label>
            </div>

            <label className="block text-xs font-medium text-[#F5EEDC]/85">
              Personal Wall Bio / Intention
              <input
                type="text"
                data-auth-bio-input
                value={bio}
                onChange={event => setBio(event.target.value)}
                placeholder="e.g. Reflecting daily on the Makki and Madani revelations..."
                className="mt-1.5 w-full rounded-xl border border-[#D4AF37]/35 bg-[#031812]/90 px-3.5 py-2 text-sm text-white placeholder:text-[#F5EEDC]/40 focus:border-[#D4AF37] focus:outline-none"
              />
            </label>

            <div>
              <p className="text-xs font-medium text-[#F5EEDC]/85">Illuminated Seal / Emblem</p>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {SEEKER_EMBLEMS.map(item => {
                  const selected = emblem === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      data-auth-emblem={item.id}
                      aria-pressed={selected}
                      onClick={() => setEmblem(item.id)}
                      className={`flex flex-col items-center gap-1.5 rounded-xl border p-2.5 text-center transition ${
                        selected
                          ? 'border-[#D4AF37] bg-[#D4AF37]/20 text-white shadow-sm'
                          : 'border-[#D4AF37]/25 bg-[#031812]/70 text-[#F5EEDC]/75 hover:border-[#D4AF37]/60'
                      }`}
                    >
                      <SeekerEmblemGlyph emblem={item.id} size={20} />
                      <span className="text-[11px] font-semibold">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {statusNote && (
              <p role="status" data-auth-status className="rounded-xl border border-[#D4AF37]/50 bg-[#0A2E23] px-3.5 py-2 text-xs font-semibold text-[#F9E7B9]">
                ✦ {statusNote}
              </p>
            )}
            {error && (
              <p role="alert" className="rounded-xl border border-red-400/40 bg-red-950/60 px-3.5 py-2 text-xs text-red-200">
                {error}
              </p>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#D4AF37]/20 pt-4">
              <button
                type="button"
                data-auth-signout
                onClick={() => void signOut()}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[#D4AF37]/35 bg-[#031812] px-3.5 py-2 text-xs font-semibold text-[#F5EEDC] transition hover:border-red-400/60 hover:text-red-200"
              >
                <LogOut className="h-3.5 w-3.5" aria-hidden />
                <span>Sign Out</span>
              </button>

              <div className="flex flex-wrap items-center gap-2">
                <a
                  href="#/quran/wall"
                  onClick={closeModal}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-[#D4AF37]/50 bg-[#0A2E23] px-3.5 py-2 text-xs font-semibold text-[#F9E7B9] transition hover:border-[#D4AF37]"
                >
                  <Sparkles className="h-3.5 w-3.5 text-[#D4AF37]" aria-hidden />
                  <span>Open My Faith Wall</span>
                </a>
                <button
                  type="submit"
                  data-auth-save-profile
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#D4AF37] px-4 py-2 text-xs font-bold text-[#031812] shadow-sm transition hover:bg-[#e3c14d] disabled:opacity-50"
                >
                  <Check className="h-3.5 w-3.5" aria-hidden />
                  <span>Save Profile</span>
                </button>
              </div>
            </div>
          </form>
        ) : (
          <div className="relative z-10 mt-5 space-y-4">
            {/* Primary Continue with Google CTA (GIS Popup Primary + Transparent GIS Overlay) */}
            <div className="space-y-2.5">
              <div className="relative">
                <button
                  type="button"
                  data-google-signin-cta
                  data-quick-auth="google"
                  disabled={busy}
                  onClick={() => void handleContinueWithGoogle()}
                  className="flex w-full items-center justify-between gap-3 rounded-2xl border-2 border-[#D4AF37]/80 bg-gradient-to-r from-[#0A2E23] via-[#0F3F30] to-[#0A2E23] px-4 py-3 text-left text-white shadow-[0_0_24px_rgba(212,175,55,0.16)] transition hover:border-[#D4AF37] hover:bg-[#124535] disabled:opacity-50"
                >
                  <span className="flex items-center gap-3">
                    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white shadow-xs">
                      <GoogleGMark size={20} />
                    </span>
                    <span>
                      <span className="block text-sm font-bold tracking-wide text-white">
                        Continue with Google
                      </span>
                      <span className="block text-[11px] text-[#F5EEDC]/75">
                        Verified Google account · Instant Personal Faith Wall sync
                      </span>
                    </span>
                  </span>
                  <span className="hidden shrink-0 rounded-full border border-[#D4AF37]/50 bg-[#031812]/80 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-[#D4AF37] sm:inline-block">
                    1-Click Sign In
                  </span>
                </button>

                {/* Google Identity Services Popup Button Overlay (when GIS script is ready) */}
                <div
                  ref={gisContainerRef}
                  data-gis-button-slot
                  className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden rounded-2xl opacity-[0.01]"
                />
              </div>

              {/* Secondary OAuth Redirect & Setup Helper Row */}
              <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-[11px] text-[#F5EEDC]/70">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    data-google-oauth-redirect-link
                    onClick={() => handleOAuthRedirectStart('/auth/callback')}
                    className="font-medium text-[#D4AF37] hover:underline"
                  >
                    Use Google Redirect Sign-In
                  </button>
                  <span aria-hidden>·</span>
                  <button
                    type="button"
                    data-google-oauth-help-toggle
                    onClick={() => setShowOAuthSetupHelp(open => !open)}
                    className="inline-flex items-center gap-1 text-[#F5EEDC]/75 hover:text-white"
                  >
                    <HelpCircle className="h-3 w-3 text-[#D4AF37]" aria-hidden />
                    <span>Google OAuth URI setup</span>
                  </button>
                </div>
              </div>

              {showOAuthSetupHelp && (
                <div
                  data-google-oauth-help
                  className="space-y-2 rounded-2xl border border-[#D4AF37]/35 bg-[#031812]/95 p-3 text-[11px] text-[#F5EEDC]/85"
                >
                  <p className="font-semibold text-[#D4AF37]">
                    Google Cloud Console OAuth 2.0 Client Settings:
                  </p>
                  <div className="flex items-center justify-between gap-2 rounded-lg border border-[#D4AF37]/20 bg-[#0A2E23]/60 px-2.5 py-1.5">
                    <span className="truncate font-mono text-[10px]">
                      Origin: {currentOrigin}
                    </span>
                    <button
                      type="button"
                      onClick={() => void copyUri(currentOrigin, 'origin')}
                      className="inline-flex shrink-0 items-center gap-1 text-[10px] font-semibold text-[#D4AF37]"
                    >
                      {copiedUri === 'origin' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                      <span>{copiedUri === 'origin' ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                  <div className="flex items-center justify-between gap-2 rounded-lg border border-[#D4AF37]/20 bg-[#0A2E23]/60 px-2.5 py-1.5">
                    <span className="truncate font-mono text-[10px]">
                      Redirect: {expectedRedirectUri}
                    </span>
                    <button
                      type="button"
                      onClick={() => void copyUri(expectedRedirectUri, 'redirect')}
                      className="inline-flex shrink-0 items-center gap-1 text-[10px] font-semibold text-[#D4AF37]"
                    >
                      {copiedUri === 'redirect' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                      <span>{copiedUri === 'redirect' ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                  <div className="flex items-center justify-between gap-2 rounded-lg border border-[#D4AF37]/20 bg-[#0A2E23]/60 px-2.5 py-1.5">
                    <span className="truncate font-mono text-[10px]">
                      Legacy Redirect: {currentOrigin}/auth/callback
                    </span>
                    <button
                      type="button"
                      onClick={() => void copyUri(`${currentOrigin}/auth/callback`, 'legacy')}
                      className="inline-flex shrink-0 items-center gap-1 text-[10px] font-semibold text-[#D4AF37]"
                    >
                      {copiedUri === 'legacy' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                      <span>{copiedUri === 'legacy' ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Secondary Quick Studio Options */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  data-quick-auth="apple"
                  disabled={busy}
                  onClick={() => void handleQuickAuth('apple')}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#D4AF37]/40 bg-[#031812]/85 px-3 py-2 text-xs font-semibold text-[#F5EEDC] transition hover:border-[#D4AF37] hover:bg-[#0A2E23]"
                >
                  <span className="font-bold text-[#D4AF37]"></span>
                  <span>Continue with Apple</span>
                </button>
                <button
                  type="button"
                  data-quick-auth="guest"
                  disabled={busy}
                  onClick={() => void handleQuickAuth('guest')}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#D4AF37]/45 bg-[#D4AF37]/15 px-3 py-2 text-xs font-semibold text-[#F9E7B9] transition hover:border-[#D4AF37] hover:bg-[#D4AF37]/25"
                >
                  <Sparkles className="h-3.5 w-3.5 text-[#D4AF37]" aria-hidden />
                  <span>Instant Seeker Pass</span>
                </button>
              </div>
            </div>

            <div className="flex items-center gap-3 text-[11px] text-[#F5EEDC]/55">
              <span className="h-px flex-1 bg-[#D4AF37]/25" />
              <span>OR CONTINUE WITH EMAIL</span>
              <span className="h-px flex-1 bg-[#D4AF37]/25" />
            </div>

            {/* Mode Switcher */}
            <div className="flex rounded-full border border-[#D4AF37]/35 bg-[#031812] p-1">
              <button
                type="button"
                data-auth-tab="signin"
                aria-pressed={tab === 'signin'}
                onClick={() => setTab('signin')}
                className={`flex-1 rounded-full py-1.5 text-xs font-semibold transition ${
                  tab === 'signin' ? 'bg-[#D4AF37] text-[#031812]' : 'text-[#F5EEDC]/80 hover:text-white'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                data-auth-tab="register"
                aria-pressed={tab === 'register'}
                onClick={() => setTab('register')}
                className={`flex-1 rounded-full py-1.5 text-xs font-semibold transition ${
                  tab === 'register' ? 'bg-[#D4AF37] text-[#031812]' : 'text-[#F5EEDC]/80 hover:text-white'
                }`}
              >
                Create Seeker Account
              </button>
            </div>

            <form onSubmit={event => void handleFormSubmit(event)} className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-xs font-medium text-[#F5EEDC]/85">
                  Email Address
                  <input
                    type="email"
                    data-auth-email-input
                    value={email}
                    onChange={event => setEmail(event.target.value)}
                    placeholder="seeker@dragondawwa.com"
                    required
                    className="mt-1.5 w-full rounded-xl border border-[#D4AF37]/35 bg-[#031812]/90 px-3.5 py-2 text-sm text-white placeholder:text-[#F5EEDC]/40 focus:border-[#D4AF37] focus:outline-none"
                  />
                </label>

                <label className="block text-xs font-medium text-[#F5EEDC]/85">
                  Password
                  <input
                    type="password"
                    data-auth-password-input
                    value={password}
                    onChange={event => setPassword(event.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={4}
                    className="mt-1.5 w-full rounded-xl border border-[#D4AF37]/35 bg-[#031812]/90 px-3.5 py-2 text-sm text-white placeholder:text-[#F5EEDC]/40 focus:border-[#D4AF37] focus:outline-none"
                  />
                </label>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-xs font-medium text-[#F5EEDC]/85">
                  Display Name
                  <input
                    type="text"
                    data-auth-name-input
                    value={name}
                    onChange={event => setName(event.target.value)}
                    placeholder="e.g. Brother Feroz Ansar"
                    className="mt-1.5 w-full rounded-xl border border-[#D4AF37]/35 bg-[#031812]/90 px-3.5 py-2 text-sm text-white placeholder:text-[#F5EEDC]/40 focus:border-[#D4AF37] focus:outline-none"
                  />
                </label>

                <label className="block text-xs font-medium text-[#F5EEDC]/85">
                  Kunyah / Title
                  <input
                    type="text"
                    data-auth-kunyah-input
                    value={kunyah}
                    onChange={event => setKunyah(event.target.value)}
                    placeholder="e.g. Seeker of Knowledge"
                    className="mt-1.5 w-full rounded-xl border border-[#D4AF37]/35 bg-[#031812]/90 px-3.5 py-2 text-sm text-white placeholder:text-[#F5EEDC]/40 focus:border-[#D4AF37] focus:outline-none"
                  />
                </label>
              </div>

              <div>
                <p className="text-xs font-medium text-[#F5EEDC]/85">Choose Your Illuminated Seal</p>
                <div className="mt-1.5 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {SEEKER_EMBLEMS.map(item => {
                    const selected = emblem === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        data-auth-emblem={item.id}
                        aria-pressed={selected}
                        onClick={() => setEmblem(item.id)}
                        className={`flex flex-col items-center gap-1 rounded-xl border p-2 text-center transition ${
                          selected
                            ? 'border-[#D4AF37] bg-[#D4AF37]/20 text-white'
                            : 'border-[#D4AF37]/25 bg-[#031812]/70 text-[#F5EEDC]/75 hover:border-[#D4AF37]/60'
                        }`}
                      >
                        <SeekerEmblemGlyph emblem={item.id} size={18} />
                        <span className="text-[11px] font-semibold">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {error && (
                <p role="alert" data-auth-error className="rounded-xl border border-red-400/40 bg-red-950/60 px-3.5 py-2 text-xs text-red-200">
                  {error}
                </p>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-xl px-3.5 py-2 text-xs font-medium text-[#F5EEDC]/75 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  data-auth-submit
                  disabled={busy}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#D4AF37] px-5 py-2.5 text-xs font-bold text-[#031812] shadow-md transition hover:bg-[#e3c14d] disabled:opacity-50"
                >
                  <LogIn className="h-3.5 w-3.5" aria-hidden />
                  <span>{tab === 'register' ? 'Create Seeker Account' : 'Sign In to Faith Wall'}</span>
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
