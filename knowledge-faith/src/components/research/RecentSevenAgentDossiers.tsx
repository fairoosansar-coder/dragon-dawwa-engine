import { useMemo } from 'react';
import {
  Bookmark,
  BookmarkCheck,
  Clock,
  FlaskConical,
  Radio,
  Sparkles,
} from 'lucide-react';
import { useRemote } from '../../lib/api.ts';
import { useApp } from '../../lib/store.tsx';
import { profileFontClass, wallFontClass } from '../../lib/typography.ts';
import type { SevenAgentResearchDossier } from '../../shared/sevenAgentTypes.ts';
import { LANGUAGE_NAMES, type Lang } from '../../shared/sources.ts';

interface HistoryPayload {
  items: SevenAgentResearchDossier[];
  saved: SevenAgentResearchDossier[];
  savedIds: string[];
}

export function RecentSevenAgentDossiers({
  activeQuestion,
  onSelectDossier,
  onOpenRoundtable,
}: {
  activeQuestion?: string;
  onSelectDossier: (dossier: SevenAgentResearchDossier) => void;
  onOpenRoundtable?: (dossier: SevenAgentResearchDossier) => void;
}) {
  const { lang, uiTheme, saved, isDossierSaved, toggleDossier } = useApp();
  const isObsidian = uiTheme === 'obsidian';
  const remote = useRemote<HistoryPayload>(`/api/research/seven-agents/history?lang=${lang}`);

  const combined = useMemo(() => {
    const map = new Map<string, SevenAgentResearchDossier>();
    for (const d of saved.dossiers ?? []) {
      map.set(d.question.trim().toLowerCase(), d);
    }
    for (const d of remote.data?.saved ?? []) {
      const k = d.question.trim().toLowerCase();
      if (!map.has(k)) map.set(k, d);
    }
    for (const d of remote.data?.items ?? []) {
      const k = d.question.trim().toLowerCase();
      if (!map.has(k)) map.set(k, d);
    }
    return [...map.values()].slice(0, 8);
  }, [saved.dossiers, remote.data]);

  if (combined.length === 0) return null;

  return (
    <section
      data-testid="recent-seven-agent-dossiers"
      style={
        isObsidian
          ? { backgroundColor: '#0A2920', color: '#F7F2E4', borderColor: 'rgba(212,175,55,0.35)' }
          : { backgroundColor: '#FFFFFF', color: '#1C1917', borderColor: '#E5DEC9' }
      }
      className={`${profileFontClass(lang)} rounded-3xl border p-4 shadow-xs sm:p-5`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-200/40 pb-3">
        <div className="flex items-center gap-2">
          <span
            style={{ backgroundColor: '#073C30', color: '#D4AF37' }}
            className="inline-flex h-8 w-8 items-center justify-center rounded-xl shadow-2xs"
          >
            <Clock className="h-4 w-4" aria-hidden />
          </span>
          <div>
            <h3
              style={{ color: isObsidian ? '#F9E7B9' : '#0F2922' }}
              className="text-xs font-extrabold uppercase tracking-wider sm:text-sm"
            >
              {lang === 'ta'
                ? 'சேமிக்கப்பட்ட & சமீபத்திய 7-முகவர் ஆய்வுகள்'
                : lang === 'si'
                  ? 'සුරැකි සහ මෑතකාලීන නියෝජිත 7 පර්යේෂණ වාර්තා'
                  : 'Saved & Recent 7-Agent Dossiers (1-Tap Instant Reopen)'}
            </h3>
            <p
              style={{ color: isObsidian ? '#C8D6CE' : '#57534E' }}
              className="text-[11px]"
            >
              {lang === 'ta'
                ? 'ஏற்கனவே ஆய்வு செய்யப்பட்ட கேள்வியை உடனடியாகத் திறக்க சொடுக்கவும்'
                : lang === 'si'
                  ? 'කලින් පර්යේෂණ කළ ප්‍රශ්නයක් තත්පරයක් තුළ නැවත විවෘත කිරීමට ක්ලික් කරන්න'
                  : 'Click any saved or recent dossier to reopen its 7-Agent Report, Modern Science Foresight & Roundtable immediately.'}
            </p>
          </div>
        </div>

        <a
          href="#/saved"
          style={{ color: isObsidian ? '#E5C158' : '#073C30' }}
          className="text-xs font-extrabold underline"
        >
          {lang === 'ta'
            ? `சேமித்தவை (${(saved.dossiers ?? []).length}) →`
            : lang === 'si'
              ? `සුරැකි ලැයිස්තුව (${(saved.dossiers ?? []).length}) →`
              : `Open Saved Library (${(saved.dossiers ?? []).length}) →`}
        </a>
      </div>

      <div className="mt-3.5 grid grid-cols-1 gap-3 md:grid-cols-2">
        {combined.map(item => {
          const isSaved = isDossierSaved(item.id) || isDossierSaved(item.question);
          const isCurrent =
            activeQuestion?.trim().toLowerCase() === item.question.trim().toLowerCase();
          const itemLang: Lang = item.lang ?? lang;

          return (
            <article
              key={item.id}
              data-testid={`recent-dossier-card-${item.id}`}
              style={
                isObsidian
                  ? {
                      backgroundColor: isCurrent ? '#134233' : '#0D3529',
                      color: '#F7F2E4',
                      borderColor: isCurrent ? '#D4AF37' : 'rgba(212,175,55,0.28)',
                    }
                  : {
                      backgroundColor: isCurrent ? '#FFFBEB' : '#FAF8F3',
                      color: '#1C1917',
                      borderColor: isCurrent ? '#F59E0B' : '#E5DEC9',
                    }
              }
              className="flex flex-col justify-between rounded-2xl border p-3.5 shadow-2xs transition hover:shadow-xs"
            >
              <div>
                <div className="flex flex-wrap items-center justify-between gap-1.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span
                      style={{ backgroundColor: '#FEF3C7', color: '#78350F', borderColor: '#F59E0B' }}
                      className="rounded-full border px-2 py-0.5 font-mono text-[10px] font-extrabold"
                    >
                      {item.confidenceScore}% · 7/7 Agents
                    </span>
                    <span
                      style={{ backgroundColor: '#CCFBF1', color: '#115E59' }}
                      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold"
                    >
                      <FlaskConical className="h-2.5 w-2.5" aria-hidden />
                      <span>1 Step Ahead</span>
                    </span>
                    <span className="rounded-full border border-stone-300/60 px-2 py-0.5 text-[10px] font-semibold">
                      {LANGUAGE_NAMES[itemLang]?.native ?? 'EN'}
                    </span>
                  </div>

                  <button
                    type="button"
                    data-testid={`toggle-save-recent-${item.id}`}
                    aria-label={isSaved ? 'Remove from Saved Library' : 'Save to Library'}
                    aria-pressed={isSaved}
                    onClick={() => toggleDossier(item)}
                    style={
                      isSaved
                        ? { backgroundColor: '#FEF3C7', color: '#78350F', borderColor: '#D4AF37' }
                        : { backgroundColor: '#FFFFFF', color: '#073C30', borderColor: '#D6C8A9' }
                    }
                    className="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-bold cursor-pointer"
                  >
                    {isSaved ? (
                      <>
                        <BookmarkCheck className="h-3 w-3 text-[#B45309]" aria-hidden />
                        <span>Saved ✓</span>
                      </>
                    ) : (
                      <>
                        <Bookmark className="h-3 w-3" aria-hidden />
                        <span>Save</span>
                      </>
                    )}
                  </button>
                </div>

                <h4
                  lang={itemLang}
                  style={{ color: isObsidian ? '#F9E7B9' : '#0F2922' }}
                  className={`${wallFontClass(itemLang, item.question)} mt-2 line-clamp-1 text-sm font-extrabold`}
                >
                  “{item.question}”
                </h4>

                <p
                  lang={itemLang}
                  style={{ color: isObsidian ? '#EAE3D2' : '#3F3A32' }}
                  className="mt-1 line-clamp-2 text-xs leading-relaxed"
                >
                  {item.verdictHeadline}
                </p>
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-stone-200/30 pt-2.5">
                <button
                  type="button"
                  data-testid={`reopen-recent-dossier-${item.id}`}
                  onClick={() => onSelectDossier(item)}
                  style={{ backgroundColor: '#073C30', color: '#F9E7B9' }}
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-extrabold shadow-2xs hover:opacity-95 cursor-pointer"
                >
                  <Sparkles className="h-3 w-3 text-[#D4AF37]" aria-hidden />
                  <span>Reopen 7-Agent Report →</span>
                </button>

                {onOpenRoundtable && (
                  <button
                    type="button"
                    onClick={() => onOpenRoundtable(item)}
                    style={{
                      backgroundColor: isObsidian ? '#134233' : '#FFFFFF',
                      color: isObsidian ? '#F9E7B9' : '#073C30',
                      borderColor: '#D4AF37',
                    }}
                    className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-bold cursor-pointer"
                  >
                    <Radio className="h-3 w-3 text-[#D4AF37]" aria-hidden />
                    <span>Roundtable</span>
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
