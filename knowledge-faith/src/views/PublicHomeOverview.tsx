import { ArrowRight, BookOpen, Compass, Globe, Lock,LogIn, Mic, ScrollText, ShieldCheck, Sparkles, Star } from 'lucide-react';
import { StudioMark, type StudioMarkName } from '../components/shell/studioMarks.tsx';
import { requestAuthenticatedNavigation, useSeekerAuth } from '../lib/seekerAuth.ts';
import { useApp } from '../lib/store.tsx';

interface PublicDeskCard {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  href: string;
  badge: string;
  mark: StudioMarkName;
}

const PUBLIC_DESKS: PublicDeskCard[] = [
  {
    id: 'quran',
    title: 'Al-Qur’an Reader & Tafsir',
    subtitle: 'Uthmani Mushaf · 4 Audio Languages · Word-by-Word',
    description: 'Read and listen to the Noble Qur’an in Arabic, Tamil, Sinhala, and English with Al-Mukhtasar tafsir and 16:9 Verse Card Studio.',
    href: '#/quran',
    badge: '114 SURAHS · LIVE AUDIO',
    mark: 'quran',
  },
  {
    id: 'hadith',
    title: 'Prophetic Sunnah (Hadith)',
    subtitle: 'Encyclopedia & Six Canonical Collections',
    description: 'Explore verified narrations, chains of transmission (Isnad), narrator biographies (Rijal), and printed scholarly grades.',
    href: '#/hadith',
    badge: 'KUTUB AL-SITTAH · VERIFIED GRADES',
    mark: 'hadith',
  },
  {
    id: 'names',
    title: '99 Names of Allah',
    subtitle: 'Asma al-Husna · Classical Meanings',
    description: 'Contemplate the Beautiful Names of Allah with Arabic calligraphy, transliteration, and documented meanings.',
    href: '#/spiritual/names',
    badge: '99 NAMES · CLASSICAL MEANINGS',
    mark: 'dua',
  },
  {
    id: 'seerah',
    title: 'Seerah & Islamic History',
    subtitle: 'Prophetic Biography & Historical Context',
    description: 'Investigate the life of the Messenger ﷺ, Madinan and Makkan milestones, and primary historical sources.',
    href: '#/hub/seerah',
    badge: 'PROPHETIC TIMELINE · RESEARCH',
    mark: 'prophet',
  },
  {
    id: 'fiqh',
    title: 'Fiqh & Contemporary Fatwa',
    subtitle: 'Jurisprudence & Everyday Practice',
    description: 'Research worship, transactions, and contemporary questions with multi-agent evidence synthesis from verified texts.',
    href: '#/hub/fiqh',
    badge: 'JURISPRUDENCE · 7-AGENT DESK',
    mark: 'checklist',
  },
  {
    id: 'podcasts',
    title: 'Research & Podcasts Studio',
    subtitle: '4-Persona Scholarly Roundtable Audio',
    description: 'Generate and listen to sourced scholarly roundtable episodes and interactive broadcast programmes with neural voices.',
    href: '#/podcast',
    badge: 'ROUNDTABLE STUDIO · NEURAL VOICE',
    mark: 'podcast',
  },
  {
    id: 'books',
    title: 'Books & Source Library',
    subtitle: 'Curated Classical & Contemporary Works',
    description: 'Read full-text Islamic books and treatises in English, Tamil, and Sinhala with in-page citations.',
    href: '#/books',
    badge: 'MULTILINGUAL LIBRARY · FULL TEXT',
    mark: 'books',
  },
  {
    id: 'shahadah',
    title: 'New to Islam (Shahadah)',
    subtitle: 'Five Pillars, Prayer Times, Qibla & Zakah',
    description: 'Step-by-step guides to the Declaration of Faith, daily Salah, Zakah calculator, and Hijri fasting calendar.',
    href: '#/spiritual',
    badge: 'FIVE PILLARS · SPIRITUAL LIFE',
    mark: 'shahadah',
  },
  {
    id: 'wall',
    title: 'Public & Personal Faith Wall',
    subtitle: '1200×675 HD Illuminated Verse Cards',
    description: 'Share illuminated manuscript ayah cards, write personal reflections, and curate your Personal Faith Wall.',
    href: '#/quran/wall',
    badge: 'COMMUNITY & MY WALL',
    mark: 'saved',
  },
];

export function PublicHomeOverview() {
  const { lang } = useApp();
  const { openModal } = useSeekerAuth();

  const triggerProtectedRoute = (href: string, label: string) => {
    requestAuthenticatedNavigation(href, label);
  };

  return (
    <div data-public-home className="space-y-4">
      {/* Hero Banner */}
      <section
        data-public-hero
        style={{
          background: 'linear-gradient(135deg, #031812 0%, #0A2E23 52%, #041812 100%)',
        }}
        className="relative overflow-hidden rounded-2xl border border-[#D4AF37]/50 p-4 text-[#F5EEDC] shadow-sm sm:p-5"
      >
        <img
          src="/assets/geometric-emerald.jpg"
          alt=""
          className="pointer-events-none absolute inset-0 h-full w-full object-cover object-center opacity-25"
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#031812]/95 via-[#07261C]/88 to-[#031812]/70" />

        {/* Inner Gold Frame */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-2 rounded-xl border border-[#D4AF37]/25"
        />

        <div className="relative z-10 flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div className="max-w-2xl space-y-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="inline-flex items-center gap-1 rounded-full border border-[#D4AF37]/60 bg-[#D4AF37]/15 px-2.5 py-0.5 text-[9px] font-semibold tracking-[0.18em] text-[#D4AF37]">
                <Sparkles className="h-2.5 w-2.5" aria-hidden />
                INSTITUTIONAL RESEARCH STUDIO
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-[#D4AF37]/30 bg-white/5 px-2 py-0.5 text-[10px] font-medium text-[#F5EEDC]/85">
                <ShieldCheck className="h-3 w-3 text-[#D4AF37]" aria-hidden />
                Verified Seeker Access
              </span>
            </div>

            <p
              dir="rtl"
              lang="ar"
              className="quran-face text-xl font-medium leading-[1.85] text-[#F9E7B9] sm:text-2xl"
            >
              طَلَبُ الْعِلْمِ فَرِيضَةٌ
            </p>

            <h1 className="font-display text-base font-bold leading-snug text-white sm:text-lg">
              Learn from Authentic Sources with Clarity, Verification & Humility
            </h1>

            <p className="text-xs leading-relaxed text-[#F5EEDC]/80">
              Welcome to <strong className="text-white">Dragon Dawwa</strong>. Sign in once with your Google or Seeker account to unlock the Noble Qur’an Reader, Prophetic Hadith Encyclopedia, 7-Agent Research Desk, Scholarly Roundtable Podcasts, and your Personal Faith Wall.
            </p>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                data-public-hero-signin
                onClick={() => openModal({ targetRoute: '#/quran/wall', deskLabel: 'Community Faith Wall' })}
                className="inline-flex items-center gap-1.5 rounded-full border border-[#D4AF37] bg-[#D4AF37] px-3.5 py-1.5 text-xs font-bold text-[#031812] shadow-2xs transition hover:bg-[#e3c14d]"
              >
                <LogIn className="h-3.5 w-3.5" aria-hidden />
                <span>Sign In to Enter Studio</span>
              </button>

              <button
                type="button"
                data-public-hero-quran
                onClick={() => triggerProtectedRoute('#/quran/book', 'Al-Qur’an Reader & Tafsir')}
                className="inline-flex items-center gap-1.5 rounded-full border border-[#D4AF37]/55 bg-[#0A2E23]/90 px-3.5 py-1.5 text-xs font-semibold text-[#F5EEDC] transition hover:border-[#D4AF37] hover:bg-[#0f3d2f]"
              >
                <BookOpen className="h-3.5 w-3.5 text-[#D4AF37]" aria-hidden />
                <span>Open Noble Qur’an</span>
              </button>

              <button
                type="button"
                data-public-hero-wall
                onClick={() => triggerProtectedRoute('#/quran/wall', 'Community Faith Wall')}
                className="inline-flex items-center gap-1.5 rounded-full border border-[#D4AF37]/45 bg-[#031812]/80 px-3.5 py-1.5 text-xs font-semibold text-[#F9E7B9] transition hover:border-[#D4AF37]"
              >
                <Globe className="h-3.5 w-3.5 text-[#D4AF37]" aria-hidden />
                <span>Explore Faith Wall</span>
              </button>
            </div>
          </div>

          {/* Daily Wisdom Preview Card (Zero-API Static Preview) */}
          <div
            data-public-daily-wisdom
            className="w-full shrink-0 rounded-xl border border-[#D4AF37]/45 bg-[#031812]/90 p-3.5 lg:w-76"
          >
            <div className="flex items-center justify-between gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#D4AF37]">
              <span>✦ Daily Qur’anic Wisdom</span>
              <span>Surah Ta-Ha 20:114</span>
            </div>
            <p
              lang="ar"
              dir="rtl"
              style={{ textShadow: '0 0 18px rgba(212,175,55,0.2)' }}
              className="quran-face mt-2 text-center text-lg leading-[1.9] text-white sm:text-xl"
            >
              وَقُل رَّبِّ زِدْنِى عِلْمًا
            </p>
            <p className="mt-1 text-center font-display text-xs italic text-[#F3E8C8]">
              “And say: My Lord, increase me in knowledge.”
            </p>
            <div className="mt-2.5 flex items-center justify-between border-t border-[#D4AF37]/20 pt-2 text-[10px]">
              <span className="text-[#F5EEDC]/70">Audio: Arabic · Tamil · Sinhala · English</span>
              <button
                type="button"
                onClick={() => triggerProtectedRoute('#/quran/book?surah=20&ayah=114', 'Surah Ta-Ha 20:114')}
                className="font-semibold text-[#D4AF37] hover:underline"
              >
                Listen & Read →
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Quick Research Omni-Trigger Bar (Opens Sign-In on Click/Submit) */}
      <section
        data-public-research-gate
        onClick={() => triggerProtectedRoute('#/hub/research', '7-Agent Research Desk')}
        className="cursor-pointer rounded-xl border border-[#073C30]/20 bg-parchment p-3.5 shadow-2xs transition hover:border-[#D4AF37] sm:p-4"
      >
        <div className="flex flex-col justify-between gap-2.5 sm:flex-row sm:items-center">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-pine">
              <Compass className="h-3.5 w-3.5 text-[#C6A15A]" aria-hidden />
              <span>Multidisciplinary 7-Agent Research Engine</span>
              <span className="inline-flex items-center gap-1 rounded-full bg-[#073C30] px-2 py-0.5 text-[9px] text-[#F9E7B9]">
                <Lock className="h-2.5 w-2.5 text-[#D4AF37]" aria-hidden />
                Sign-In Required
              </span>
            </div>
            <p className="text-xs text-muted">
              Ask any question across Qur’an, Tafsir, Kutub al-Sittah, Fiqh, and Seerah—synthesized only from cited primary texts.
            </p>
          </div>
          <button
            type="button"
            data-public-research-btn
            onClick={event => {
              event.stopPropagation();
              triggerProtectedRoute('#/hub/research', '7-Agent Research Desk');
            }}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[#073C30] px-3.5 py-1.5 text-xs font-semibold text-[#F5EEDC] transition hover:bg-[#0A2E23]"
          >
            <Sparkles className="h-3 w-3 text-[#D4AF37]" aria-hidden />
            <span>Sign In to Start Research</span>
          </button>
        </div>
      </section>

      {/* Studio Desks Grid */}
      <section className="space-y-2.5" data-public-desks-section>
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">
              ✦ Explore Dragon Dawwa Desks ({lang.toUpperCase()})
            </p>
            <h2 className="mt-0.5 font-display text-sm font-bold text-pine sm:text-base">
              Select Any Desk to Sign In & Enter
            </h2>
          </div>
          <p className="text-[11px] text-muted">
            Compulsory Seeker Sign-In protects live scholarly & AI resources from automated abuse.
          </p>
        </div>

        <div data-public-desk-grid className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {PUBLIC_DESKS.map(desk => (
            <a
              key={desk.id}
              href={desk.href}
              data-public-desk-card={desk.id}
              onClick={event => {
                event.preventDefault();
                triggerProtectedRoute(desk.href, desk.title);
              }}
              className="group relative flex h-full flex-col justify-between overflow-hidden rounded-xl border border-pine/15 bg-parchment p-3.5 text-left shadow-2xs transition duration-200 hover:-translate-y-0.5 hover:border-[#C6A15A] hover:shadow-sm"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <StudioMark name={desk.mark} className="h-8 w-8 shrink-0 rounded-lg border border-[#C6A15A]/40 shadow-2xs" />
                  <span className="inline-flex items-center gap-1 rounded-full border border-[#073C30]/15 bg-sand px-2 py-0.5 text-[9px] font-semibold tracking-wider text-pine">
                    <Lock className="h-2.5 w-2.5 text-[#C6A15A]" aria-hidden />
                    {desk.badge}
                  </span>
                </div>

                <h3 className="mt-2.5 font-display text-sm font-bold text-pine group-hover:text-[#073C30]">
                  {desk.title}
                </h3>
                <p className="mt-0.5 text-[11px] font-semibold text-[#0B4B3A]/80">
                  {desk.subtitle}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-muted">
                  {desk.description}
                </p>
              </div>

              <div className="mt-2.5 flex items-center justify-between border-t border-pine/10 pt-2 text-[11px] font-semibold text-pine">
                <span className="group-hover:underline">Sign in to open desk</span>
                <ArrowRight className="h-3.5 w-3.5 text-[#C6A15A] transition-transform group-hover:translate-x-1" aria-hidden />
              </div>
            </a>
          ))}
        </div>
      </section>

      {/* Bottom Institutional Assurance Strip */}
      <section className="grid gap-3.5 rounded-2xl border border-[#C6A15A]/40 bg-[#073C30] p-4 text-[#F5EEDC] sm:grid-cols-3 sm:p-5">
        <div className="flex items-start gap-3">
          <ScrollText className="mt-0.5 h-5 w-5 shrink-0 text-[#D4AF37]" aria-hidden />
          <div>
            <h3 className="font-display text-sm font-bold text-[#F9E7B9]">Primary Sources Only</h3>
            <p className="mt-1 text-xs leading-relaxed text-[#F5EEDC]/75">
              Every Qur’an verse, tafsir passage, and hadith grade is retrieved directly from verified canonical collections and classical commentaries.
            </p>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <Mic className="mt-0.5 h-5 w-5 shrink-0 text-[#D4AF37]" aria-hidden />
          <div>
            <h3 className="font-display text-sm font-bold text-[#F9E7B9]">Multilingual Audio & Studio</h3>
            <p className="mt-1 text-xs leading-relaxed text-[#F5EEDC]/75">
              Listen to Arabic Qari recitation alongside Tamil, Sinhala, and English meaning audio and 4-persona scholarly roundtables.
            </p>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <Star className="mt-0.5 h-5 w-5 shrink-0 text-[#D4AF37]" aria-hidden />
          <div>
            <h3 className="font-display text-sm font-bold text-[#F9E7B9]">Personal Faith Wall</h3>
            <p className="mt-1 text-xs leading-relaxed text-[#F5EEDC]/75">
              Export 1200×675 HD illuminated manuscript cards and save personal reflections under your verified Seeker profile.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
