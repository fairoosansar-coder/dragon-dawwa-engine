import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Check, ChevronDown, Copy, HelpCircle, LogIn, LogOut, Settings, ShieldCheck, Sparkles, User, X } from 'lucide-react';
import { RubElHizb } from '../engine/ds/ornaments.tsx';
import { ProfileSettingsPanel } from './ProfileSettingsPanel.tsx';
import {
  buildGoogleOAuthRedirectUrl,
  ensureGoogleGisLoaded,
  SEEKER_EMBLEMS,
  useSeekerAuth,
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
        oauth2?: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            prompt?: string;
            callback: (response: { access_token?: string; error?: string; error_description?: string }) => void;
            error_callback?: (err: { type?: string; message?: string }) => void;
          }) => {
            requestAccessToken: (overrideConfig?: { prompt?: string }) => void;
          };
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
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    const handleHashChange = () => setMenuOpen(false);
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('hashchange', handleHashChange);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, [menuOpen]);

  if (variant === 'header') {
    const shortName = user?.name
      ? user.name.length > 16
        ? user.name.split(/\s+/).slice(0, 2).join(' ')
        : user.name
      : 'Sign in';
    return (
      <div ref={menuRef} className="relative shrink-0">
        <button
          type="button"
          data-header-account-pill
          aria-expanded={menuOpen}
          aria-haspopup="dialog"
          onClick={() => setMenuOpen(open => !open)}
          title={user ? `${user.name} · Profile & Display Settings` : 'Sign in & Display Settings'}
          className="inline-flex h-7.5 shrink-0 items-center gap-1.5 rounded-full border border-[#D4AF37]/50 bg-[#073C30] px-2.5 text-[11px] font-medium text-[#F5EEDC] shadow-2xs transition hover:border-[#D4AF37] hover:bg-[#0A2E23] sm:text-xs"
        >
          <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#D4AF37]/45 bg-[#031812]">
            {user ? (
              <SeekerAvatar avatarUrl={user.avatarUrl} name={user.name} emblem={user.emblem} size={11} />
            ) : (
              <LogIn className="h-2.5 w-2.5 text-[#D4AF37]" aria-hidden />
            )}
          </span>
          <span className="max-w-[6.75rem] truncate sm:max-w-[9.5rem]">{shortName}</span>
          <Settings className="h-3 w-3 shrink-0 text-[#D4AF37]/90" aria-hidden />
          <ChevronDown className="h-3 w-3 shrink-0 text-[#F5EEDC]/70" aria-hidden />
        </button>

        {menuOpen && (
          <div
            role="dialog"
            aria-label="Profile and Display Settings"
            data-profile-settings-popover
            className="absolute right-0 top-full z-50 mt-2 w-80 max-w-[calc(100vw-1.5rem)] rounded-2xl border border-stone-200 bg-white p-3.5 text-stone-900 shadow-xl ring-1 ring-black/5"
          >
            <div className="flex items-center justify-between gap-2 border-b border-stone-100 pb-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#073C30] text-[#F5EEDC] ring-2 ring-emerald-600/30">
                  {user ? (
                    <SeekerAvatar avatarUrl={user.avatarUrl} name={user.name} emblem={user.emblem} size={18} />
                  ) : (
                    <User className="h-4 w-4 text-[#D4AF37]" aria-hidden />
                  )}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-xs font-bold text-stone-900">
                    {user ? user.name : 'Sign In Required'}
                  </p>
                  <p className="truncate text-[11px] text-stone-500">
                    {user ? user.kunyah : 'Sign in with credentials or Google'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                aria-label="Close settings menu"
                className="inline-flex h-6 w-6 items-center justify-center rounded-full text-stone-400 hover:bg-stone-100 hover:text-stone-700"
              >
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            </div>

            <div className="mt-2.5 grid grid-cols-2 gap-1.5 border-b border-stone-100 pb-3">
              <a
                href="#/profile"
                data-popover-open-profile
                onClick={() => setMenuOpen(false)}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-stone-200 bg-stone-50 px-2.5 py-1.5 text-xs font-semibold text-stone-800 transition hover:border-emerald-700/40 hover:bg-emerald-50/50"
              >
                <User className="h-3.5 w-3.5 text-emerald-700" aria-hidden />
                <span>My Profile</span>
              </a>
              <button
                type="button"
                data-popover-open-account
                onClick={() => {
                  setMenuOpen(false);
                  openModal();
                }}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-stone-200 bg-stone-50 px-2.5 py-1.5 text-xs font-semibold text-stone-800 transition hover:border-emerald-700/40 hover:bg-emerald-50/50"
              >
                <Settings className="h-3.5 w-3.5 text-[#C6A15A]" aria-hidden />
                <span>{user ? 'Edit Identity' : 'Sign In'}</span>
              </button>
            </div>

            <div className="mt-3">
              <ProfileSettingsPanel compact />
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="mb-2 space-y-1.5">
      <button
        type="button"
        data-seeker-account-pill
        onClick={() => openModal()}
        className="flex w-full items-center gap-2.5 rounded-2xl border border-[#E6DEC8] bg-white px-3 py-2.5 text-left text-[#18221D] shadow-2xs transition hover:border-[#0F5132]"
      >
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[#E6DEC8] bg-[#FAF7F0]">
          {user ? (
            <SeekerAvatar avatarUrl={user.avatarUrl} name={user.name} emblem={user.emblem} size={18} />
          ) : (
            <User className="h-4 w-4 text-[#0F5132]" aria-hidden />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="truncate text-xs font-semibold text-[#18221D]">
              {user ? user.name : 'Sign In · My Account'}
            </p>
            {user?.verified && <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-[#0F5132]" aria-hidden />}
          </div>
          <p className="truncate text-[11px] text-stone-500">
            {user ? user.kunyah : 'Credentials or Google Auth'}
          </p>
        </div>
      </button>
      {user && (
        <a
          href="#/profile"
          data-sidebar-profile-link
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-[#E6DEC8] bg-[#FAF7F0] px-2.5 py-1.5 text-[11px] font-semibold text-[#0F5132] transition hover:border-[#0F5132] hover:bg-white"
        >
          <User className="h-3 w-3 text-[#0F5132]" aria-hidden />
          <span>My Profile & Settings</span>
        </a>
      )}
    </div>
  );
}

export function SeekerAuthCard({
  inline = false,
  onClose,
}: {
  inline?: boolean;
  onClose?: () => void;
}) {
  const {
    user,
    googleAuth,
    modalOpen,
    pendingDesk,
    closeModal,
    loginOrRegister,
    signInWithGoogleCredential,
    signInWithGoogleAccessToken,
    updateProfile,
    signOut,
  } = useSeekerAuth();

  const [tab, setTab] = useState<'signin' | 'register'>('signin');
  const [identifier, setIdentifier] = useState('');
  const [contact, setContact] = useState('');
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
  const tokenClientRef = useRef<{ requestAccessToken: (overrideConfig?: { prompt?: string }) => void } | null>(null);

  const dismiss = onClose ?? closeModal;

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
      try {
        const authErr = new URL(window.location.href).searchParams.get('auth_error');
        if (authErr) {
          setError(`Google Sign-In could not be completed (${authErr}). Please try again.`);
        }
      } catch {
        setError('Google Sign-In could not be completed. Please try again.');
      }
    }
  }, [user, modalOpen, inline]);

  useEffect(() => {
    if (user || !googleAuth.enabled || !googleAuth.clientId) return;
    let active = true;
    void ensureGoogleGisLoaded().then(loaded => {
      if (!active || !loaded) return;
      const gId = window.google?.accounts?.id;
      const gOAuth2 = window.google?.accounts?.oauth2;
      const slot = gisContainerRef.current;

      if (gOAuth2?.initTokenClient) {
        try {
          tokenClientRef.current = gOAuth2.initTokenClient({
            client_id: googleAuth.clientId!,
            scope: 'openid email profile',
            prompt: 'select_account',
            callback: response => {
              if (response.error || !response.access_token) {
                setShowOAuthSetupHelp(true);
                setError(
                  response.error_description ||
                    response.error ||
                    'Google Sign-In was cancelled or blocked. Ensure Authorized JavaScript Origin is set in Google Cloud Console.',
                );
                return;
              }
              setBusy(true);
              setError(null);
              void signInWithGoogleAccessToken(response.access_token)
                .then(() => {
                  setStatusNote('Signed in with Google.');
                  dismiss();
                })
                .catch((err: unknown) => {
                  setError(err instanceof Error ? err.message : 'Google Sign-In failed.');
                })
                .finally(() => setBusy(false));
            },
            error_callback: err => {
              if (err?.type === 'popup_closed') return;
              setShowOAuthSetupHelp(true);
              setError(
                err?.message ||
                  'Google Sign-In popup could not open. Ensure Authorized JavaScript Origin is configured in Google Cloud Console.',
              );
            },
          });
        } catch {
          /* ignore token client init error */
        }
      }

      if (!gId || !slot) return;
      try {
        gId.initialize({
          client_id: googleAuth.clientId!,
          ux_mode: 'popup',
          itp_support: true,
          callback: response => {
            if (!response.credential) {
              setError('Google Sign-In did not return a valid credential.');
              return;
            }
            setBusy(true);
            setError(null);
            void signInWithGoogleCredential(response.credential)
              .then(() => {
                setStatusNote('Signed in with Google.');
                dismiss();
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
          theme: 'outline',
          size: 'large',
          shape: 'pill',
          text: 'continue_with',
          width: 340,
        });
      } catch {
        /* ignore GIS script initialization errors */
      }
    });
    return () => {
      active = false;
    };
  }, [user, googleAuth.enabled, googleAuth.clientId, signInWithGoogleCredential, signInWithGoogleAccessToken, dismiss]);

  const myPosts = user
    ? listFaithWallPosts().filter(post => !post.isAnonymous && (post.userId === user.id || post.authorName === user.name))
    : [];
  const totalAmeen = myPosts.reduce((sum, post) => sum + (post.likes ?? 1), 0);
  const isGoogleUser = Boolean(user && (user.authProvider === 'google' || user.provider === 'google'));

  const currentOrigin =
    typeof window !== 'undefined' && window.location.origin
      ? window.location.origin
      : 'https://dragon-dawwa-production.up.railway.app';
  const expectedRedirectUri =
    googleAuth.redirectUriOverride || `${currentOrigin}${googleAuth.callbackPath || '/api/auth/google/callback'}`;

  const copyUri = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedUri(label);
      window.setTimeout(() => setCopiedUri(current => (current === label ? null : current)), 2200);
    } catch {
      /* ignore */
    }
  };

  // Kept for OAuth redirect URI helper / direct server redirect verification
  const handleOAuthRedirectStart = (callbackPath?: string) => {
    if (typeof window === 'undefined') return;
    window.location.href = buildGoogleOAuthRedirectUrl(undefined, callbackPath);
  };
  void handleOAuthRedirectStart;

  const handleContinueWithGoogle = async () => {
    setError(null);
    if (!googleAuth.enabled || !googleAuth.clientId) {
      setShowOAuthSetupHelp(true);
      setError('Google Sign-In is not configured on this server. Please sign in with your username, email, or phone number below.');
      return;
    }

    const loaded = await ensureGoogleGisLoaded();
    const gOAuth2 = window.google?.accounts?.oauth2;
    const gId = window.google?.accounts?.id;

    // 1. Primary: Google OAuth2 Popup Token Client (uses redirect_uri='postmessage' — never hits /api/auth/google/callback redirect_uri_mismatch)
    if (loaded && (tokenClientRef.current || gOAuth2?.initTokenClient)) {
      try {
        if (!tokenClientRef.current && gOAuth2?.initTokenClient) {
          tokenClientRef.current = gOAuth2.initTokenClient({
            client_id: googleAuth.clientId,
            scope: 'openid email profile',
            prompt: 'select_account',
            callback: response => {
              if (response.error || !response.access_token) {
                setShowOAuthSetupHelp(true);
                setError(
                  response.error_description ||
                    response.error ||
                    'Google Sign-In was cancelled or blocked.',
                );
                return;
              }
              setBusy(true);
              setError(null);
              void signInWithGoogleAccessToken(response.access_token)
                .then(() => {
                  setStatusNote('Signed in with Google.');
                  dismiss();
                })
                .catch((err: unknown) => {
                  setError(err instanceof Error ? err.message : 'Google Sign-In failed.');
                })
                .finally(() => setBusy(false));
            },
          });
        }
        tokenClientRef.current?.requestAccessToken({ prompt: 'select_account' });
        return;
      } catch {
        /* fall through to GIS ID prompt */
      }
    }

    // 2. Fallback: Google Identity Services (GIS) popup button / One Tap prompt
    if (loaded && gId) {
      const gisBtn = gisContainerRef.current?.querySelector<HTMLElement>('[role="button"], div[tabindex="0"]');
      if (gisBtn) {
        gisBtn.click();
        return;
      }
      gId.prompt(notification => {
        if (notification.isNotDisplayed?.() || notification.isSkippedMoment?.()) {
          setShowOAuthSetupHelp(true);
          setError(
            'Google Sign-In popup was blocked or origin is not authorized. Please sign in with your username, email, or phone number below, or add the Authorized JavaScript Origin in Google Cloud Console.',
          );
        }
      });
      return;
    }

    setShowOAuthSetupHelp(true);
    setError(
      'Google Sign-In script could not be loaded (check ad-blocker or network). Please sign in with your username, email, or phone number below.',
    );
  };

  const handleFormSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setStatusNote(null);
    try {
      if (tab === 'register') {
        const trimmedContact = contact.trim() || identifier.trim();
        const isPhone = trimmedContact && !trimmedContact.includes('@') && /^\+?[\d\s()-]{7,20}$/.test(trimmedContact);
        await loginOrRegister({
          mode: 'register',
          provider: isPhone ? 'phone' : 'email',
          identifier: trimmedContact,
          email: isPhone ? undefined : trimmedContact,
          phone: isPhone ? trimmedContact : undefined,
          username: name.trim(),
          name: name.trim(),
          password,
        });
        setStatusNote('Your account is ready.');
      } else {
        const trimmedId = identifier.trim();
        await loginOrRegister({
          mode: 'login',
          identifier: trimmedId,
          email: trimmedId,
          password,
        });
        setStatusNote('Signed in.');
      }
      dismiss();
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
      setStatusNote('Profile updated!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update profile.');
    } finally {
      setBusy(false);
    }
  };

  if (user) {
    return (
      <div
        data-seeker-auth-card
        style={{ backgroundColor: '#FFFFFF', color: '#18221D', borderColor: '#E6DEC8' }}
        className="relative w-full max-w-[460px] rounded-2xl border border-[#E6DEC8] bg-[#FFFFFF] p-5 text-[#18221D] shadow-md sm:p-6"
        onClick={event => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#0F5132]/20 bg-[#FAF7F0] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.16em] text-[#0F5132]">
              <Sparkles className="h-3 w-3 text-[#C6A15A]" aria-hidden />
              DRAGON DAWWA · ACCOUNT
            </span>
            <h2 className="mt-1.5 font-display text-lg font-bold text-[#18221D] sm:text-xl">
              Your Seeker Profile
            </h2>
          </div>
          {!inline && (
            <button
              type="button"
              aria-label="Close"
              onClick={dismiss}
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#E6DEC8] bg-[#FAF7F0] text-stone-600 transition hover:border-[#0F5132] hover:text-[#18221D]"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          )}
        </div>

        <form onSubmit={event => void handleProfileSave(event)} className="mt-4 space-y-3.5">
          <div
            data-seeker-active-card
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#E6DEC8] bg-[#FAF7F0] p-3.5"
          >
            <div className="flex min-w-0 items-center gap-3">
              <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[#E6DEC8] bg-[#0F5132] text-[#F5EEDC]">
                <SeekerAvatar avatarUrl={user.avatarUrl} name={user.name} emblem={emblem} size={22} />
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <p className="truncate font-display text-sm font-bold text-[#18221D]">{user.name}</p>
                  <span className="inline-flex items-center gap-1 rounded-full border border-[#0F5132]/20 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-[#0F5132]">
                    <ShieldCheck className="h-3 w-3" aria-hidden />
                    {isGoogleUser ? 'Google Verified' : 'Verified'}
                  </span>
                </div>
                <p className="truncate text-xs text-[#0F5132]">{user.kunyah}</p>
                <p className="truncate text-[11px] text-stone-500">{user.phone || user.email}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 text-center">
              <div className="rounded-lg border border-[#E6DEC8] bg-white px-2.5 py-1">
                <p className="font-display text-sm font-bold text-[#0F5132]">{myPosts.length}</p>
                <p className="text-[9px] uppercase tracking-wider text-stone-500">Cards</p>
              </div>
              <div className="rounded-lg border border-[#E6DEC8] bg-white px-2.5 py-1">
                <p className="font-display text-sm font-bold text-[#0F5132]">{totalAmeen}</p>
                <p className="text-[9px] uppercase tracking-wider text-stone-500">Ameen</p>
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs font-semibold text-[#18221D]">
              Display Name
              <input
                type="text"
                data-auth-name-input
                value={name}
                onChange={event => setName(event.target.value)}
                required
                className="mt-1 w-full rounded-xl border border-[#E6DEC8] bg-[#FAF7F0] px-3 py-2 text-sm text-[#18221D] focus:border-[#0F5132] focus:bg-white focus:outline-none"
              />
            </label>

            <label className="block text-xs font-semibold text-[#18221D]">
              Kunyah / Title
              <input
                type="text"
                data-auth-kunyah-input
                value={kunyah}
                onChange={event => setKunyah(event.target.value)}
                required
                className="mt-1 w-full rounded-xl border border-[#E6DEC8] bg-[#FAF7F0] px-3 py-2 text-sm text-[#18221D] focus:border-[#0F5132] focus:bg-white focus:outline-none"
              />
            </label>
          </div>

          <label className="block text-xs font-semibold text-[#18221D]">
            Personal Bio
            <input
              type="text"
              data-auth-bio-input
              value={bio}
              onChange={event => setBio(event.target.value)}
              placeholder="Reflecting daily on the Qur’an and Sunnah…"
              className="mt-1 w-full rounded-xl border border-[#E6DEC8] bg-[#FAF7F0] px-3 py-2 text-sm text-[#18221D] placeholder:text-stone-400 focus:border-[#0F5132] focus:bg-white focus:outline-none"
            />
          </label>

          <div>
            <p className="text-xs font-semibold text-[#18221D]">Profile Seal</p>
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
                        ? 'border-[#0F5132] bg-emerald-50/80 text-[#0F5132]'
                        : 'border-[#E6DEC8] bg-[#FAF7F0] text-stone-600 hover:border-[#0F5132]/50'
                    }`}
                  >
                    <SeekerEmblemGlyph emblem={item.id} size={18} />
                    <span className="text-[11px] font-semibold">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {statusNote && (
            <p role="status" data-auth-status className="rounded-xl border border-emerald-700/25 bg-emerald-50 px-3 py-2 text-xs font-semibold text-[#0F5132]">
              ✦ {statusNote}
            </p>
          )}
          {error && (
            <p role="alert" data-auth-error className="rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-xs font-medium text-red-800">
              {error}
            </p>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#E6DEC8] pt-3.5">
            <button
              type="button"
              data-auth-signout
              onClick={() => void signOut()}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#E6DEC8] bg-[#FAF7F0] px-3 py-2 text-xs font-semibold text-stone-700 transition hover:border-red-300 hover:bg-red-50 hover:text-red-700"
            >
              <LogOut className="h-3.5 w-3.5" aria-hidden />
              <span>Sign Out</span>
            </button>

            <div className="flex flex-wrap items-center gap-2">
              <a
                href="#/profile"
                onClick={dismiss}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[#E6DEC8] bg-[#FAF7F0] px-3 py-2 text-xs font-semibold text-[#18221D] transition hover:border-[#0F5132]"
              >
                <User className="h-3.5 w-3.5 text-[#0F5132]" aria-hidden />
                <span>My Profile</span>
              </a>
              <button
                type="submit"
                data-auth-save-profile
                disabled={busy}
                style={{ backgroundColor: '#0F5132', color: '#FFFFFF' }}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#0F5132] px-4 py-2 text-xs font-bold text-white shadow-2xs transition hover:bg-[#0B3E26] disabled:opacity-50"
              >
                <Check className="h-3.5 w-3.5" aria-hidden />
                <span>Save Profile</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div
      data-seeker-auth-card
      style={{ backgroundColor: '#FFFFFF', color: '#18221D', borderColor: '#E6DEC8' }}
      className="relative mx-auto w-full max-w-[400px] rounded-2xl border border-[#E6DEC8] bg-[#FFFFFF] p-6 text-[#18221D] shadow-sm sm:p-7"
      onClick={event => event.stopPropagation()}
    >
      {/* 1. Compact DRAGON DAWWA Brand Mark + Concise 1-Line Subtitle */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-[#0F5132]">
            <Sparkles className="h-3.5 w-3.5 text-[#C6A15A]" aria-hidden />
            <span>DRAGON DAWWA</span>
          </div>
          <h1 className="mt-1 font-display text-xl font-bold tracking-tight text-[#18221D]">
            {pendingDesk ? `Sign in to ${pendingDesk}` : 'Welcome to Dragon Dawwa'}
          </h1>
          <p data-auth-modal-subtitle className="mt-0.5 text-xs text-stone-600">
            Sign in with your username, email, phone number, or Google.
          </p>
        </div>
        {!inline && (
          <button
            type="button"
            aria-label="Close"
            onClick={dismiss}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#E6DEC8] bg-[#FAF7F0] text-stone-500 transition hover:border-[#0F5132] hover:text-[#18221D]"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        )}
      </div>

      {/* 2. Clean Sign In / Create Account Tab Toggle */}
      <div
        role="tablist"
        aria-label="Authentication mode"
        style={{ backgroundColor: '#FAF7F0', borderColor: '#E6DEC8' }}
        className="mt-4 grid grid-cols-2 rounded-xl border border-[#E6DEC8] bg-[#FAF7F0] p-1"
      >
        <button
          type="button"
          role="tab"
          data-auth-tab="signin"
          aria-selected={tab === 'signin'}
          aria-pressed={tab === 'signin'}
          onClick={() => {
            setTab('signin');
            setError(null);
          }}
          style={
            tab === 'signin'
              ? { backgroundColor: '#FFFFFF', color: '#18221D' }
              : { backgroundColor: 'transparent', color: '#57534E' }
          }
          className={`rounded-lg py-1.5 text-xs font-semibold transition cursor-pointer ${
            tab === 'signin' ? 'bg-white text-[#18221D] shadow-2xs' : 'text-stone-600 hover:text-[#18221D]'
          }`}
        >
          Sign In
        </button>
        <button
          type="button"
          role="tab"
          data-auth-tab="register"
          aria-selected={tab === 'register'}
          aria-pressed={tab === 'register'}
          onClick={() => {
            setTab('register');
            setError(null);
          }}
          style={
            tab === 'register'
              ? { backgroundColor: '#FFFFFF', color: '#18221D' }
              : { backgroundColor: 'transparent', color: '#57534E' }
          }
          className={`rounded-lg py-1.5 text-xs font-semibold transition cursor-pointer ${
            tab === 'register' ? 'bg-white text-[#18221D] shadow-2xs' : 'text-stone-600 hover:text-[#18221D]'
          }`}
        >
          Create Account
        </button>
      </div>

      {/* 3. Continue with Google Button at Top with Clean White Surface (Popup postmessage / GIS — never triggers redirect_uri_mismatch) */}
      <div className="mt-4 space-y-2">
        <div className="relative">
          <button
            type="button"
            data-testid="auth-google-btn"
            data-google-signin-cta
            disabled={busy}
            onClick={() => void handleContinueWithGoogle()}
            style={{ backgroundColor: '#FFFFFF', color: '#18221D', borderColor: '#E6DEC8' }}
            className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-[#E6DEC8] bg-white px-4 py-2.5 text-xs font-semibold text-[#18221D] shadow-2xs transition hover:border-[#0F5132] hover:bg-[#FAF7F0] disabled:opacity-50 cursor-pointer"
          >
            <GoogleGMark size={18} />
            <span>Continue with Google</span>
          </button>

          <div
            ref={gisContainerRef}
            data-gis-button-slot
            className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden rounded-xl opacity-[0.01]"
          />
        </div>

        {showOAuthSetupHelp && (
          <div
            data-google-oauth-help
            className="space-y-1.5 rounded-xl border border-[#E6DEC8] bg-[#FAF7F0] p-2.5 text-[11px] text-stone-700"
          >
            <div className="flex items-center justify-between">
              <p className="inline-flex items-center gap-1 font-semibold text-[#0F5132]">
                <HelpCircle className="h-3 w-3" aria-hidden />
                <span>Google Cloud Console OAuth 2.0 Settings</span>
              </p>
              <button
                type="button"
                onClick={() => setShowOAuthSetupHelp(false)}
                className="text-[10px] text-stone-500 hover:text-[#18221D]"
              >
                Hide
              </button>
            </div>
            <div className="flex items-center justify-between gap-2 rounded-lg border border-[#E6DEC8] bg-white px-2 py-1">
              <span className="truncate font-mono text-[10px]">Origin: {currentOrigin}</span>
              <button
                type="button"
                onClick={() => void copyUri(currentOrigin, 'origin')}
                className="inline-flex shrink-0 items-center gap-1 text-[10px] font-semibold text-[#0F5132]"
              >
                {copiedUri === 'origin' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                <span>{copiedUri === 'origin' ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
            <div className="flex items-center justify-between gap-2 rounded-lg border border-[#E6DEC8] bg-white px-2 py-1">
              <span className="truncate font-mono text-[10px]">Redirect: {expectedRedirectUri}</span>
              <button
                type="button"
                onClick={() => void copyUri(expectedRedirectUri, 'redirect')}
                className="inline-flex shrink-0 items-center gap-1 text-[10px] font-semibold text-[#0F5132]"
              >
                {copiedUri === 'redirect' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                <span>{copiedUri === 'redirect' ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 4. Subtle Divider */}
      <div className="my-4 flex items-center gap-3 text-[11px] text-stone-400">
        <span className="h-px flex-1 bg-[#E6DEC8]" />
        <span>or sign in with credentials</span>
        <span className="h-px flex-1 bg-[#E6DEC8]" />
      </div>

      {/* 5. Credentials Form */}
      <form onSubmit={event => void handleFormSubmit(event)} className="space-y-3">
        {tab === 'signin' ? (
          <label className="block text-xs font-semibold text-[#18221D]">
            Username, Email, or Phone Number
            <input
              type="text"
              data-testid="auth-identifier-input"
              data-auth-email-input
              value={identifier}
              onChange={event => setIdentifier(event.target.value)}
              placeholder="e.g. ahmad_k, name@email.com, or +971 50 123 4567"
              autoComplete="username"
              required
              style={{ backgroundColor: '#FAF7F0', color: '#18221D', borderColor: '#E6DEC8' }}
              className="mt-1 w-full rounded-xl border border-[#E6DEC8] bg-[#FAF7F0] px-3.5 py-2.5 text-sm text-[#18221D] placeholder:text-stone-400 focus:border-[#0F5132] focus:bg-white focus:outline-none"
            />
          </label>
        ) : (
          <>
            <label className="block text-xs font-semibold text-[#18221D]">
              Username or Full Name
              <input
                type="text"
                data-testid="auth-register-name-input"
                data-auth-name-input
                value={name}
                onChange={event => setName(event.target.value)}
                placeholder="e.g. ahmad_k or Ahmad Khalid"
                autoComplete="name"
                required
                style={{ backgroundColor: '#FAF7F0', color: '#18221D', borderColor: '#E6DEC8' }}
                className="mt-1 w-full rounded-xl border border-[#E6DEC8] bg-[#FAF7F0] px-3.5 py-2.5 text-sm text-[#18221D] placeholder:text-stone-400 focus:border-[#0F5132] focus:bg-white focus:outline-none"
              />
            </label>

            <label className="block text-xs font-semibold text-[#18221D]">
              Email or Phone Number
              <input
                type="text"
                data-testid="auth-identifier-input"
                data-auth-email-input
                value={contact}
                onChange={event => setContact(event.target.value)}
                placeholder="name@email.com or +971 50 123 4567"
                autoComplete="email"
                required
                style={{ backgroundColor: '#FAF7F0', color: '#18221D', borderColor: '#E6DEC8' }}
                className="mt-1 w-full rounded-xl border border-[#E6DEC8] bg-[#FAF7F0] px-3.5 py-2.5 text-sm text-[#18221D] placeholder:text-stone-400 focus:border-[#0F5132] focus:bg-white focus:outline-none"
              />
            </label>
          </>
        )}

        <label className="block text-xs font-semibold text-[#18221D]">
          Password
          <input
            type="password"
            data-testid="auth-password-input"
            data-auth-password-input
            value={password}
            onChange={event => setPassword(event.target.value)}
            placeholder="••••••••"
            autoComplete={tab === 'register' ? 'new-password' : 'current-password'}
            required
            minLength={4}
            style={{ backgroundColor: '#FAF7F0', color: '#18221D', borderColor: '#E6DEC8' }}
            className="mt-1 w-full rounded-xl border border-[#E6DEC8] bg-[#FAF7F0] px-3.5 py-2.5 text-sm text-[#18221D] placeholder:text-stone-400 focus:border-[#0F5132] focus:bg-white focus:outline-none"
          />
        </label>

        {error && (
          <p
            role="alert"
            data-auth-error
            className="rounded-xl border border-red-300 bg-red-50 px-3.5 py-2 text-xs font-medium text-red-800"
          >
            {error}
          </p>
        )}

        <button
          type="submit"
          data-testid="auth-submit-btn"
          data-auth-submit
          disabled={busy}
          style={{ backgroundColor: '#0F5132', color: '#FFFFFF' }}
          className="mt-1 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#0F5132] px-4 py-2.5 text-xs font-bold text-white shadow-xs transition hover:bg-[#0B3E26] disabled:opacity-50 cursor-pointer"
        >
          <LogIn className="h-3.5 w-3.5" aria-hidden />
          <span>{tab === 'register' ? 'Create Account' : 'Sign In'}</span>
        </button>
      </form>
    </div>
  );
}

export function SeekerAuthModal() {
  const { user, modalOpen, closeModal } = useSeekerAuth();

  useEffect(() => {
    if (!modalOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && user) closeModal();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [modalOpen, user, closeModal]);

  if (!modalOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Seeker Sign In & Account"
      data-seeker-auth-modal
      style={{ backgroundColor: 'rgba(250, 247, 240, 0.88)' }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#FAF7F0]/90 p-4 backdrop-blur-xs"
      onClick={() => {
        if (user) closeModal();
      }}
    >
      <SeekerAuthCard onClose={closeModal} />
    </div>
  );
}
