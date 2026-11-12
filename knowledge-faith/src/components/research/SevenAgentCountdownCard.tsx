import { useEffect, useState } from 'react';
import {
  Award,
  BookOpen,
  Check,
  FlaskConical,
  Layers,
  Scale,
  ScrollText,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { AudioLoadingSpinner } from '../AudioLoadingSpinner.tsx';
import type { Lang } from '../../shared/sources.ts';

const AGENT_STAGES: ReadonlyArray<{
  number: number;
  icon: typeof BookOpen;
  accentHex: string;
  label: Record<Lang, string>;
  role: Record<Lang, string>;
}> = [
  {
    number: 1,
    icon: BookOpen,
    accentHex: '#B45309',
    label: {
      en: '01 · Qur’an & Tafsir',
      ta: '01 · குர்ஆன் & தஃப்ஸீர்',
      si: '01 · අල්-කුර්ආන් සහ තෆ්සීර්',
    },
    role: {
      en: 'Scanning primary verses & classical commentary',
      ta: 'திருவசனங்கள் & விரிவுரை ஆய்வு',
      si: 'මූලික වැකි සහ විවරණ පරීක්ෂාව',
    },
  },
  {
    number: 2,
    icon: ScrollText,
    accentHex: '#0F5132',
    label: {
      en: '02 · Prophetic Hadith & Sunnah',
      ta: '02 · நபிமொழி & சுன்னா',
      si: '02 · නබිවදන් සහ සුන්නාව',
    },
    role: {
      en: 'Retrieving Kutub al-Sittah & HadeethEnc narrations',
      ta: 'குதுப் அஸ்-ஸித்தா ஹதீஸ் ஆதாரங்கள்',
      si: 'කුතුබ් අස්-සිත්තා හදීස් මූලාශ්‍ර',
    },
  },
  {
    number: 3,
    icon: ShieldCheck,
    accentHex: '#1E3A8A',
    label: {
      en: '03 · Isnad Verification',
      ta: '03 · இஸ்னாத் தர ஆய்வு',
      si: '03 · ඉස්නාද් පූර්වගාමී පරීක්ෂාව',
    },
    role: {
      en: 'Auditing narrator chains & Sahih gradings',
      ta: 'அறிவிப்பாளர் தொடர் & தரம் சரிபார்ப்பு',
      si: 'වාර්තාකරුවන්ගේ දාමය සහ සහීහ් තත්ත්වය',
    },
  },
  {
    number: 4,
    icon: Scale,
    accentHex: '#92400E',
    label: {
      en: '04 · Classical Fiqh Consensus',
      ta: '04 · ஃபிக்ஹ் & இஜ்மா',
      si: '04 · ෆික්හ් සහ විද්වත් එකඟතාව',
    },
    role: {
      en: 'Comparing the 4 Sunni schools & medical exceptions',
      ta: 'நான்கு மத்ஹப்கள் & ஏகோபித்த முடிவு',
      si: 'ගුරුකුල හතර සහ වෛද්‍ය ව්‍යතිරේක',
    },
  },
  {
    number: 5,
    icon: Layers,
    accentHex: '#6B21A8',
    label: {
      en: '05 · Linguistic & Maqasid',
      ta: '05 · மொழியியல் & மகாஸித்',
      si: '05 · භාෂාමය සහ මකාසිද් ප්‍රඥාව',
    },
    role: {
      en: 'Analyzing Arabic roots & higher Shariah wisdom',
      ta: 'அரபு வேர்ச்சொல் & ஷரீஅத் நோக்கங்கள்',
      si: 'අරාබි වචන මූල සහ ෂරීආ අරමුණු',
    },
  },
  {
    number: 6,
    icon: FlaskConical,
    accentHex: '#0F766E',
    label: {
      en: '06 · Modern Science (1 Step Ahead)',
      ta: '06 · நவீன அறிவியல் (1 Step Ahead)',
      si: '06 · නවීන විද්‍යාව (1 Step Ahead)',
    },
    role: {
      en: 'Evaluating biomedical, physiological & empirical foresight',
      ta: 'மருத்துவ & உயிரியல் முன்னோடி ஆய்வு',
      si: 'ජৈව වෛද්‍ය සහ නවීන විද්‍යාත්මක ඉදිරි දැක්ම',
    },
  },
  {
    number: 7,
    icon: Award,
    accentHex: '#073C30',
    label: {
      en: '07 · Executive Verdict & Roundtable',
      ta: '07 · இறுதித் தீர்ப்பு & வட்டமேசை',
      si: '07 · අවසාන නිගමනය සහ වටමේස සංවාදය',
    },
    role: {
      en: 'Synthesizing final ruling & multi-voice roundtable script',
      ta: 'இறுதித் தொகுப்பு & வட்டமேசை உரையாடல்',
      si: 'අවසාන සාරාංශය සහ වටමේස පිටපත',
    },
  },
];

export function useResearchCountdown(active: boolean, totalSeconds = 12) {
  const [remainingSeconds, setRemainingSeconds] = useState(totalSeconds);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    if (!active) {
      setRemainingSeconds(totalSeconds);
      setElapsedSeconds(0);
      return;
    }
    setRemainingSeconds(totalSeconds);
    setElapsedSeconds(0);
    const timer = window.setInterval(() => {
      setElapsedSeconds(prev => prev + 1);
      setRemainingSeconds(prev => (prev > 1 ? prev - 1 : 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [active, totalSeconds]);

  const activeStageIndex = Math.min(
    6,
    Math.floor(((totalSeconds - remainingSeconds) / Math.max(1, totalSeconds)) * 7),
  );
  const percent = Math.min(
    96,
    Math.max(12, Math.round(((totalSeconds - remainingSeconds + 1) / totalSeconds) * 100)),
  );

  return {
    remainingSeconds,
    elapsedSeconds,
    activeStageIndex,
    activeStageNumber: activeStageIndex + 1,
    percent,
  };
}

export function SevenAgentCountdownCard({
  question,
  lang,
  totalSeconds = 12,
}: {
  question?: string;
  lang: Lang;
  totalSeconds?: number;
}) {
  const { remainingSeconds, elapsedSeconds, activeStageIndex, activeStageNumber, percent } =
    useResearchCountdown(true, totalSeconds);

  const headline =
    lang === 'ta'
      ? `7 சிறப்பு முகவர்கள் ஆதாரங்களையும் நவீன அறிவியலையும் ஆய்வு செய்கின்றனர்…`
      : lang === 'si'
        ? `විශේෂඥ නියෝජිතයින් 7 දෙනා මූලාශ්‍ර සහ නවීන විද්‍යාව විශ්ලේෂණය කරමින් සිටී…`
        : `7 Specialist Agents are analyzing primary sources & modern science…`;

  const subline =
    lang === 'ta'
      ? `மதிப்பிடப்பட்ட மீதமுள்ள நேரம்: ${remainingSeconds} விநாடிகள் · முகவர் ${activeStageNumber} / 7 இயங்குகிறது`
      : lang === 'si'
        ? `ඇස්තමේන්තුගත ඉතිරි කාලය: තත්පර ${remainingSeconds} · නියෝජිත ${activeStageNumber} / 7 ක්‍රියාත්මකයි`
        : `Estimated time remaining: ${remainingSeconds}s · Agent ${activeStageNumber} of 7 active (${elapsedSeconds}s elapsed)`;

  const circumference = 2 * Math.PI * 42;
  const strokeDashoffset = circumference - (percent / 100) * circumference;

  return (
    <section
      data-testid="seven-agent-countdown-card"
      aria-live="polite"
      style={{
        background: 'linear-gradient(135deg, #FFFDF9 0%, #FAF6EC 60%, #F3EFE2 100%)',
        color: '#1C1917',
        borderColor: '#E2D5B5',
      }}
      className="rounded-3xl border p-5 shadow-md sm:p-7"
    >
      <div className="flex flex-col items-center justify-between gap-5 sm:flex-row">
        {/* Left: Circular SVG Radial Countdown Timer */}
        <div className="flex items-center gap-4">
          <div
            data-testid="countdown-radial-ring"
            className="relative flex h-24 w-24 shrink-0 items-center justify-center"
          >
            <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r="42"
                fill="#FFFFFF"
                stroke="#E7E0D0"
                strokeWidth="7"
              />
              <circle
                cx="50"
                cy="50"
                r="42"
                fill="none"
                stroke="#0F5132"
                strokeWidth="7"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                className="transition-all duration-500 ease-out"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span
                data-testid="countdown-seconds-remaining"
                style={{ color: '#073C30' }}
                className="font-mono text-xl font-extrabold leading-none"
              >
                {remainingSeconds}s
              </span>
              <span
                style={{ color: '#78350F' }}
                className="mt-0.5 font-mono text-[10px] font-bold"
              >
                {percent}%
              </span>
            </div>
          </div>

          <div className="space-y-1">
            <span
              style={{
                backgroundColor: '#FEF3C7',
                color: '#78350F',
                borderColor: '#F59E0B',
              }}
              className="inline-flex items-center gap-1.5 rounded-full border px-3 py-0.5 text-[11px] font-extrabold uppercase tracking-wider"
            >
              <Sparkles className="h-3 w-3 text-[#B45309]" aria-hidden />
              <span>7-Agent Live Countdown · Stage {activeStageNumber} of 7</span>
            </span>

            <h3
              lang={lang}
              style={{ color: '#0F2922' }}
              className="font-display text-base font-extrabold sm:text-lg"
            >
              {headline}
            </h3>

            <p
              lang={lang}
              style={{ color: '#57534E' }}
              className="text-xs font-medium sm:text-sm"
            >
              {subline}
            </p>

            {question && (
              <p
                style={{ color: '#78350F' }}
                className="line-clamp-1 text-xs italic"
              >
                “{question}”
              </p>
            )}
          </div>
        </div>

        {/* Right: Active Stage Pill */}
        <div
          style={{
            backgroundColor: '#FFFFFF',
            borderColor: '#D6C8A9',
            color: '#073C30',
          }}
          className="flex shrink-0 items-center gap-2 rounded-2xl border px-4 py-2.5 text-xs font-extrabold shadow-2xs"
        >
          <AudioLoadingSpinner size={16} className="text-[#0F5132]" />
          <span>
            Agent {activeStageNumber} / 7 Active
          </span>
        </div>
      </div>

      {/* 7-Agent Live Stage Grid */}
      <div
        data-testid="countdown-stages-grid"
        className="mt-5 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4"
      >
        {AGENT_STAGES.map((stage, idx) => {
          const Icon = stage.icon;
          const isCompleted = idx < activeStageIndex;
          const isCurrent = idx === activeStageIndex;

          return (
            <div
              key={stage.number}
              data-testid={`countdown-stage-${stage.number}`}
              data-stage-status={isCompleted ? 'completed' : isCurrent ? 'active' : 'pending'}
              style={{
                backgroundColor: isCurrent
                  ? '#FFFBEB'
                  : isCompleted
                    ? '#ECFDF5'
                    : '#FFFFFF',
                borderColor: isCurrent
                  ? '#F59E0B'
                  : isCompleted
                    ? '#10B981'
                    : '#E7E0D0',
                borderLeftWidth: '4px',
                borderLeftColor: isCurrent
                  ? '#D97706'
                  : isCompleted
                    ? '#059669'
                    : stage.accentHex,
              }}
              className="flex items-start justify-between gap-2.5 rounded-2xl border p-3 shadow-2xs transition-all"
            >
              <div className="flex min-w-0 items-start gap-2.5">
                <span
                  style={{
                    backgroundColor: isCompleted
                      ? '#059669'
                      : isCurrent
                        ? '#D97706'
                        : '#F5EFE2',
                    color: isCompleted || isCurrent ? '#FFFFFF' : '#44403C',
                  }}
                  className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-xl text-xs font-bold"
                >
                  {isCompleted ? (
                    <Check className="h-3.5 w-3.5" aria-hidden />
                  ) : isCurrent ? (
                    <AudioLoadingSpinner size={14} />
                  ) : (
                    <Icon className="h-3.5 w-3.5" aria-hidden />
                  )}
                </span>

                <div className="min-w-0">
                  <p
                    lang={lang}
                    style={{ color: '#1C1917' }}
                    className="truncate text-xs font-extrabold"
                  >
                    {stage.label[lang] ?? stage.label.en}
                  </p>
                  <p
                    lang={lang}
                    style={{ color: '#57534E' }}
                    className="line-clamp-1 text-[11px]"
                  >
                    {stage.role[lang] ?? stage.role.en}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
