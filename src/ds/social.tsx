// Community — Dragon Dawwa's religion-only social platform (redesign).
// Share, ask and learn about the deen: posts are typed (Reflection, Ayah, Hadith, Question,
// Du'a, Lesson), Ayah and Hadith posts must cite their source, Hadith can be verified by the
// 6-agent engine, and questions of fiqh wait for verified scholars.
// Sample texts are well-known, correctly referenced narrations and ayat; people are fictional.
import React from 'react';
import { widgetText } from './widgetI18n';
import { useCommunityWidgets } from './communityWidgets';
import {
  HandHeart, Lightbulb, Bookmark, BookMarked, MessageCircle, Share2, Flag, Send, ShieldCheck,
  HelpCircle, BookOpen, Feather, ScrollText, CalendarDays, Users, House, Compass, HeartHandshake, Check, Camera, ImagePlus, PenLine, MapPin,
} from 'lucide-react';
import { PublicWallFeed } from '../components/PublicWallFeed';
import { SupportedLanguage } from '../utils/localization';
import { StarDivider, RubElHizb, PatternSurface } from './ornaments';
import { samples } from './samples';

const cx = (...c: Array<string | false | undefined | null>) => c.filter(Boolean).join(' ');

/* ---------- types ---------- */
export type PostKind = 'reflection' | 'ayah' | 'hadith' | 'question' | 'dua' | 'lesson';
export interface CommunityAuthor { name: string; role: 'Verified Scholar' | 'Verified Teacher' | 'Student of Knowledge' | 'Member'; }
export interface CommunityAnswer { author: CommunityAuthor; text: string; }
export interface CommunityPostData {
  id: string;
  kind: PostKind;
  author: CommunityAuthor;
  time: string;
  topic: string;
  arabic?: string;
  text: string;
  source?: string;
  verified?: string;
  event?: { when: string; where: string };
  answer?: CommunityAnswer;
  answersCount?: number;
  thanks: number;
  benefit: number;
  comments: number;
}

export const TOPICS = ["Qur'an & Tafsir", 'Hadith', 'Aqidah', 'Fiqh', 'Seerah', 'Akhlaq & Adab', "Du'a & Dhikr", 'Arabic'];

const KIND: Record<PostKind, { label: string; icon: React.FC<any>; tone: string }> = {
  reflection: { label: 'Reflection', icon: Feather, tone: 'bg-amber-950/70 text-amber-300 border-amber-600/40' },
  ayah: { label: 'Ayah', icon: BookOpen, tone: 'bg-emerald-950/70 text-emerald-300 border-emerald-600/40' },
  hadith: { label: 'Hadith', icon: ScrollText, tone: 'bg-emerald-950/70 text-emerald-300 border-emerald-600/40' },
  question: { label: 'Question', icon: HelpCircle, tone: 'bg-cyan-950/70 text-cyan-300 border-cyan-600/40' },
  dua: { label: "Du'a", icon: HeartHandshake, tone: 'bg-teal-950/70 text-teal-300 border-teal-600/40' },
  lesson: { label: 'Halaqah', icon: CalendarDays, tone: 'bg-purple-950/70 text-purple-300 border-purple-600/40' },
};

export const COMMUNITY_POSTS: CommunityPostData[] = [
  {
    id: 'p1', kind: 'hadith', topic: "Qur'an & Tafsir", time: '2h',
    author: { name: 'Ustadh Hamza R.', role: 'Verified Teacher' },
    arabic: 'خَيْرُكُمْ مَنْ تَعَلَّمَ الْقُرْآنَ وَعَلَّمَهُ',
    text: '“The best of you are those who learn the Qur’an and teach it.” Our new weekend tajwid circle starts after Fajr — whoever learns one ayah and teaches it to their family has a share in this.',
    source: 'Sahih al-Bukhari 5027', verified: 'Sahih · verified by the 6 agents',
    thanks: 214, benefit: 96, comments: 18,
  },
  {
    id: 'p2', kind: 'ayah', topic: "Qur'an & Tafsir", time: '4h',
    author: { name: 'Aisha N.', role: 'Student of Knowledge' },
    arabic: 'إِنَّ مَعَ ٱلۡعُسۡرِ يُسۡرٗا',
    text: '“Indeed, with hardship [will be] ease.” It is said twice in the surah. A week of exams and a sick parent at home — this ayah carried me through every night.',
    source: 'Surah Ash-Sharh 94:6',
    thanks: 341, benefit: 120, comments: 42,
  },
  {
    id: 'p3', kind: 'question', topic: "Qur'an & Tafsir", time: '6h',
    author: { name: 'Yusuf M.', role: 'Member' },
    text: 'As a working adult with little free time, how should I begin memorising the Qur’an so that it stays with me?',
    answersCount: 3,
    answer: { author: { name: 'Shaykh Ibrahim K.', role: 'Verified Scholar' }, text: 'Begin small and stay consistent: a few lines every day after Fajr, recite them in your prayers, and revise the old portion before adding new. Find a teacher to correct your recitation, and ask Allah for ease.' },
    thanks: 88, benefit: 151, comments: 3,
  },
  {
    id: 'p4', kind: 'dua', topic: "Du'a & Dhikr", time: '9h',
    author: { name: 'Maryam S.', role: 'Member' },
    arabic: 'اللَّهُمَّ إِنِّي أَسْأَلُكَ عِلْمًا نَافِعًا، وَرِزْقًا طَيِّبًا، وَعَمَلًا مُتَقَبَّلًا',
    text: '“O Allah, I ask You for beneficial knowledge, good provision and accepted deeds.” The Prophet ﷺ would say this after Fajr. Please remember our students in your du’as this week.',
    source: 'Sunan Ibn Majah 925',
    thanks: 402, benefit: 77, comments: 25,
  },
  {
    id: 'p5', kind: 'lesson', topic: 'Seerah', time: '1d',
    author: { name: 'Masjid Al-Noor Circle', role: 'Verified Teacher' },
    text: 'Seerah circle: the Hijrah to Madinah — lessons in trust, planning and brotherhood. Open to brothers and sisters; questions welcome after the lesson.',
    event: { when: 'Thursday · after Maghrib', where: 'Online and at Masjid Al-Noor, Colombo' },
    thanks: 63, benefit: 40, comments: 9,
  },
];

/* ---------- small pieces ---------- */
const StarAvatar: React.FC<{ size?: number }> = ({ size = 40 }) => (
  <div className="shrink-0 rounded-xl flex items-center justify-center border border-amber-500/30" style={{ width: size, height: size, background: 'var(--brand-green)' }}>
    <RubElHizb size={Math.round(size * 0.6)} />
  </div>
);

const RoleBadge: React.FC<{ role: CommunityAuthor['role'] }> = ({ role }) => {
  const verified = role === 'Verified Scholar' || role === 'Verified Teacher';
  return (
    <span className={cx('inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full border',
      verified ? 'bg-emerald-950/80 text-emerald-300 border-emerald-600/50' : 'bg-slate-900 text-slate-400 border-slate-700')}>
      {verified && <ShieldCheck className="w-3 h-3" />}{role}
    </span>
  );
};

const ArabicBlock: React.FC<{ text: string; source?: string }> = ({ text, source }) => (
  <div className="rounded-2xl border islamic-gold-border px-5 py-4" style={{ backgroundColor: 'var(--surface-inset)', backgroundImage: 'var(--pattern-star)' }}>
    <div className="font-arabic text-[24px] leading-[44px] text-amber-200 text-right" dir="rtl" lang="ar">{text}</div>
    {source && (
      <div className="mt-2 flex justify-end">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-mono text-amber-300 bg-amber-950/60 border border-amber-600/40 px-2 py-0.5 rounded-lg">
          <BookMarked className="w-3 h-3" />{source}
        </span>
      </div>
    )}
  </div>
);

/* ---------- CommunityPost ---------- */
export interface CommunityPostProps { post: CommunityPostData; }
export const CommunityPost: React.FC<CommunityPostProps> = ({ post }) => {
  const k = KIND[post.kind];
  const [thanked, setThanked] = React.useState(false);
  const [benefited, setBenefited] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const thanksLabel = post.kind === 'dua' ? 'Ameen' : 'JazakAllahu khayran';
  const ThanksIcon = post.kind === 'dua' ? HeartHandshake : HandHeart;
  return (
    <article className="bg-[var(--surface-panel)] border border-slate-800 rounded-3xl p-4 sm:p-6 shadow-xl space-y-4">
      <header className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <StarAvatar />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-bold text-white text-sm">{post.author.name}</span>
              <RoleBadge role={post.author.role} />
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">{post.time} · {post.topic}</div>
          </div>
        </div>
        <span className={cx('inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-xl border', k.tone)}>
          <k.icon className="w-3.5 h-3.5" />{k.label}
        </span>
      </header>

      {post.arabic && <ArabicBlock text={post.arabic} source={post.source} />}
      {!post.arabic && post.source && <div className="text-[11px] font-mono text-amber-300">{post.source}</div>}
      <p className={cx('text-slate-200 leading-relaxed', post.kind === 'question' ? 'font-display text-xl text-white' : 'text-[15px]')}>{post.text}</p>

      {post.verified && (
        <div className="inline-flex items-center gap-2 text-xs font-semibold text-emerald-300 bg-emerald-950/70 border border-emerald-600/50 px-3 py-1.5 rounded-xl">
          <ShieldCheck className="w-4 h-4" />{post.verified}
        </div>
      )}

      {post.event && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-purple-600/40 bg-purple-950/40 px-4 py-3">
          <div className="text-sm">
            <div className="flex items-center gap-2 font-semibold text-purple-300"><CalendarDays className="w-4 h-4" />{post.event.when}</div>
            <div className="text-slate-400 text-xs mt-0.5">{post.event.where}</div>
          </div>
          <button type="button" className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-[var(--on-gold)] text-xs font-bold cursor-pointer">Join the circle</button>
        </div>
      )}

      {post.kind === 'question' && (
        post.answer ? (
          <div className="rounded-2xl border border-emerald-600/40 bg-emerald-950/30 p-4 space-y-2">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span className="font-bold text-emerald-300">Answered by {post.answer.author.name}</span>
              <RoleBadge role={post.answer.author.role} />
            </div>
            <p className="text-sm text-slate-200 leading-relaxed">{post.answer.text}</p>
            {post.answersCount && post.answersCount > 1 && (
              <button type="button" className="text-xs font-semibold text-amber-300 hover:text-amber-200 cursor-pointer">See {post.answersCount - 1} more answers</button>
            )}
          </div>
        ) : (
          <div className="rounded-2xl border border-cyan-600/40 bg-cyan-950/30 px-4 py-3 text-xs text-cyan-300 flex items-center gap-2">
            <HelpCircle className="w-4 h-4" />Awaiting an answer from a verified scholar
          </div>
        )
      )}

      <footer className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-800">
        <button type="button" onClick={() => setThanked(v => !v)}
          className={cx('inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold cursor-pointer transition-colors',
            thanked ? 'bg-amber-500 text-[var(--on-gold)] border-amber-500' : 'bg-slate-900 text-slate-300 border-slate-700 hover:border-amber-500/50')}>
          <ThanksIcon className="w-3.5 h-3.5" />{thanksLabel}<span className="font-mono opacity-80">{post.thanks + (thanked ? 1 : 0)}</span>
        </button>
        <button type="button" onClick={() => setBenefited(v => !v)}
          className={cx('inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold cursor-pointer transition-colors',
            benefited ? 'bg-emerald-950 text-emerald-300 border-emerald-600/60' : 'bg-slate-900 text-slate-300 border-slate-700 hover:border-emerald-600/50')}>
          <Lightbulb className="w-3.5 h-3.5" />Beneficial<span className="font-mono opacity-80">{post.benefit + (benefited ? 1 : 0)}</span>
        </button>
        <button type="button" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border bg-slate-900 text-slate-300 border-slate-700 text-xs font-semibold cursor-pointer">
          <MessageCircle className="w-3.5 h-3.5" />{post.kind === 'question' ? 'Answer' : 'Discuss'}<span className="font-mono opacity-80">{post.comments}</span>
        </button>
        <div className="flex-1" />
        <button type="button" onClick={() => setSaved(v => !v)} title="Save for study"
          className={cx('p-2 rounded-xl border cursor-pointer', saved ? 'text-amber-300 border-amber-600/50 bg-amber-950/50' : 'text-slate-400 border-slate-700 bg-slate-900')}>
          <Bookmark className="w-3.5 h-3.5" />
        </button>
        <button type="button" title="Share" className="p-2 rounded-xl border text-slate-400 border-slate-700 bg-slate-900 cursor-pointer"><Share2 className="w-3.5 h-3.5" /></button>
        <button type="button" title="Report" className="p-2 rounded-xl border text-slate-500 border-slate-800 bg-transparent cursor-pointer"><Flag className="w-3.5 h-3.5" /></button>
      </footer>
    </article>
  );
};

/* ---------- CommunityComposer ---------- */
const COMPOSE_KINDS: PostKind[] = ['reflection', 'ayah', 'hadith', 'question', 'dua', 'lesson'];
export interface CommunityComposerProps { onPost?: (p: CommunityPostData) => void; initialKind?: PostKind; }
export const CommunityComposer: React.FC<CommunityComposerProps> = ({ onPost, initialKind = 'hadith' }) => {
  const [kind, setKind] = React.useState<PostKind>(initialKind);
  const [topic, setTopic] = React.useState(TOPICS[1]);
  const [text, setText] = React.useState('');
  const [arabic, setArabic] = React.useState('');
  const [source, setSource] = React.useState('');
  const [verify, setVerify] = React.useState(true);
  const needsSource = kind === 'ayah' || kind === 'hadith';
  const ready = text.trim().length > 0 && (!needsSource || source.trim().length > 0);
  const prompt: Record<PostKind, string> = {
    reflection: 'Share a lesson or reflection that benefited you…',
    ayah: 'Share the meaning of the ayah and what it teaches…',
    hadith: 'Share the hadith’s meaning and its lesson…',
    question: 'Ask a question about the deen — verified scholars will answer…',
    dua: 'Share a du’a from the Qur’an or Sunnah…',
    lesson: 'Announce a halaqah: topic, time and place…',
  };
  const post = () => {
    if (!ready) return;
    onPost?.({ id: 'n' + Date.now(), kind, topic, time: 'now', author: { name: samples.user.display_name, role: 'Student of Knowledge' },
      arabic: arabic || undefined, text, source: source || undefined, verified: kind === 'hadith' && verify ? 'Verification queued with the 6 agents' : undefined,
      thanks: 0, benefit: 0, comments: 0 });
    setText(''); setArabic(''); setSource('');
  };
  return (
    <section className="bg-[var(--surface-panel)] border islamic-gold-border rounded-3xl p-4 sm:p-6 shadow-xl space-y-4 islamic-gold-glow">
      <div className="flex items-center gap-3">
        <StarAvatar size={36} />
        <div className="font-display text-xl font-semibold text-white">Share beneficial knowledge</div>
      </div>
      <div className="flex flex-wrap gap-2">
        {COMPOSE_KINDS.map(k => {
          const K = KIND[k];
          return (
            <button key={k} type="button" onClick={() => setKind(k)}
              className={cx('inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold cursor-pointer transition-colors',
                kind === k ? 'bg-amber-500 text-[var(--on-gold)] border-amber-500' : 'bg-slate-900 text-slate-300 border-slate-700 hover:border-amber-500/50')}>
              <K.icon className="w-3.5 h-3.5" />{K.label}
            </button>
          );
        })}
      </div>
      {(kind === 'ayah' || kind === 'hadith' || kind === 'dua') && (
        <textarea value={arabic} onChange={e => setArabic(e.target.value)} dir="rtl" lang="ar" rows={2}
          placeholder={kind === 'ayah' ? 'نص الآية' : kind === 'hadith' ? 'نص الحديث' : 'نص الدعاء'}
          className="w-full rounded-2xl border border-slate-700 bg-[var(--surface-inset)] px-4 py-3 font-arabic text-xl text-amber-200 placeholder:text-slate-500 focus:outline-none focus:border-amber-500/60" />
      )}
      <textarea value={text} onChange={e => setText(e.target.value)} rows={3} placeholder={prompt[kind]}
        className="w-full rounded-2xl border border-slate-700 bg-[var(--surface-inset)] px-4 py-3 text-[15px] text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-amber-500/60" />
      <div className="grid sm:grid-cols-2 gap-3">
        <label className="block">
          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">Source {needsSource ? '(required)' : '(optional)'}</span>
          <input value={source} onChange={e => setSource(e.target.value)}
            placeholder={kind === 'ayah' ? 'Surah & ayah, e.g. Al-Baqarah 2:286' : 'Collection & number, e.g. Sahih Muslim 2699'}
            className={cx('mt-1 w-full rounded-xl border bg-[var(--surface-inset)] px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none',
              needsSource && !source ? 'border-amber-600/60' : 'border-slate-700')} />
        </label>
        <label className="block">
          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">Topic</span>
          <select value={topic} onChange={e => setTopic(e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-700 bg-[var(--surface-inset)] px-3 py-2 text-sm text-slate-200 focus:outline-none">
            {TOPICS.map(t => <option key={t}>{t}</option>)}
          </select>
        </label>
      </div>
      {kind === 'hadith' && (
        <label className="flex items-center gap-2 text-xs text-emerald-300 cursor-pointer select-none">
          <input type="checkbox" checked={verify} onChange={e => setVerify(e.target.checked)} className="accent-emerald-500" />
          <ShieldCheck className="w-4 h-4" />Verify with the 6-agent engine before it appears on the wall
        </label>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <p className="text-[11px] text-slate-400 max-w-md">Share only Qur’an, Sunnah and beneficial knowledge, with sources. Questions of fatwa are answered by verified scholars.</p>
        <button type="button" onClick={post} disabled={!ready}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 text-[var(--on-gold)] text-sm font-bold shadow-xl shadow-amber-500/20 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">
          <Send className="w-4 h-4" />{kind === 'question' ? 'Ask' : 'Share'}
        </button>
      </div>
    </section>
  );
};


/* ---------- ProfileHeader — cover banner + profile picture (replaces the hero banner on Community) ---------- */
export type CoverStyle = 'lattice' | 'mihrab' | 'mushaf';
const COVER_NAMES: Record<CoverStyle, string> = { lattice: 'Star lattice', mihrab: 'Mihrab', mushaf: 'Mushaf gold' };
const MIHRAB_SVG = (stroke: string) => 'url("data:image/svg+xml,' + encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="220" viewBox="0 0 180 220"><g fill="none" stroke="${stroke}" stroke-width="1.4" stroke-opacity=".55"><path d="M20 220V96C20 60 62 42 90 12C118 42 160 60 160 96V220"/><path d="M34 220V102C34 72 70 56 90 32C110 56 146 72 146 102V220"/></g></svg>`) + '")';

const coverStyle = (c: CoverStyle, image?: string): React.CSSProperties => {
  if (image) return { backgroundImage: `linear-gradient(to top, rgba(0,0,0,.35), transparent 55%), url("${image}")`, backgroundSize: 'cover', backgroundPosition: 'center' };
  if (c === 'mihrab') return { backgroundColor: 'var(--brand-green)', backgroundImage: `radial-gradient(ellipse at 50% 120%, rgba(195,154,52,.35), transparent 60%), ${MIHRAB_SVG('#d4ae4a')}`, backgroundSize: 'auto, 180px 220px', backgroundPosition: 'center, center bottom', backgroundRepeat: 'no-repeat, repeat-x' };
  if (c === 'mushaf') return { backgroundColor: '#f3ead6', backgroundImage: `radial-gradient(ellipse at 50% 0%, rgba(176,138,46,.25), transparent 65%), var(--pattern-star-strong)`, boxShadow: 'inset 0 0 0 6px #f3ead6, inset 0 0 0 7px rgba(176,138,46,.6), inset 0 0 0 11px #f3ead6, inset 0 0 0 12px rgba(176,138,46,.35)' };
  return { backgroundColor: 'var(--brand-green)', backgroundImage: `radial-gradient(ellipse at 30% 0%, rgba(195,154,52,.30), transparent 60%), url("data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><g fill="none" stroke="#d4ae4a" stroke-opacity=".35" stroke-width="1"><rect x="20" y="20" width="24" height="24"/><rect x="20" y="20" width="24" height="24" transform="rotate(45 32 32)"/><rect x="-12" y="-12" width="24" height="24"/><rect x="52" y="52" width="24" height="24"/><rect x="52" y="-12" width="24" height="24"/><rect x="-12" y="52" width="24" height="24"/></g></svg>')}")` };
};

export interface ProfileHeaderProps {
  name?: string; role?: CommunityAuthor['role']; bio?: string; location?: string;
  cover?: CoverStyle; coverImage?: string; photo?: string; editable?: boolean;
  stats?: Array<[string, string | number]>;
}
export const ProfileHeader: React.FC<ProfileHeaderProps> = ({
  name = samples.user.display_name, role = 'Student of Knowledge',
  bio = 'Seeking beneficial knowledge — learning tajwid and the Forty Hadith of an-Nawawi. “My Lord, increase me in knowledge.”',
  location = 'Colombo, Sri Lanka', cover: coverInit = 'lattice', coverImage: coverImgInit, photo: photoInit, editable = true,
  stats = [['Shared', 12], ['Questions asked', 5], ['Halaqat joined', 3], ['Hadith verified', 9]],
}) => {
  const [cover, setCover] = React.useState<CoverStyle>(coverInit);
  const [coverImage, setCoverImage] = React.useState<string | undefined>(coverImgInit);
  const [photo, setPhoto] = React.useState<string | undefined>(photoInit);
  const [picker, setPicker] = React.useState(false);
  const photoRef = React.useRef<HTMLInputElement>(null);
  const coverRef = React.useRef<HTMLInputElement>(null);
  const read = (f: File | undefined, set: (s: string) => void) => { if (!f) return; const r = new FileReader(); r.onload = () => set(String(r.result)); r.readAsDataURL(f); };
  return (
    <section className="bg-[var(--surface-panel)] border islamic-gold-border rounded-3xl overflow-hidden shadow-xl">
      <div className="relative h-40 md:h-56" style={coverStyle(cover, coverImage)}>
        {!coverImage && cover !== 'mushaf' && (
          <div className="absolute inset-x-0 top-5 md:top-6 text-center font-arabic text-[20px] md:text-[26px] leading-[40px] md:leading-[44px]" style={{ color: '#eedb9b' }} dir="rtl" lang="ar">بِسۡمِ ٱللَّهِ ٱلرَّحۡمَٰنِ ٱلرَّحِيمِ</div>
        )}
        {!coverImage && cover === 'mushaf' && (
          <div className="absolute inset-x-0 top-6 md:top-7 text-center font-arabic text-[20px] md:text-[26px] leading-[40px] md:leading-[44px]" style={{ color: '#76591a' }} dir="rtl" lang="ar">بِسۡمِ ٱللَّهِ ٱلرَّحۡمَٰنِ ٱلرَّحِيمِ</div>
        )}
        {editable && (
          <div className="absolute top-3 right-3 md:top-4 md:right-4 flex flex-col items-end gap-2">
            <button type="button" onClick={() => setPicker(v => !v)}
              className="inline-flex items-center gap-1.5 p-2 md:px-3 md:py-1.5 rounded-xl text-xs font-semibold backdrop-blur cursor-pointer" aria-label="Change cover" style={{ background: 'rgba(8,19,15,.55)', color: '#fbf8f0', border: '1px solid rgba(212,174,74,.45)' }}>
              <ImagePlus className="w-3.5 h-3.5" /><span className="hidden md:inline">Change cover</span>
            </button>
            {picker && (
              <div className="w-56 p-2 rounded-2xl bg-[var(--surface-panel)] border islamic-gold-border shadow-2xl space-y-1">
                {(Object.keys(COVER_NAMES) as CoverStyle[]).map(c => (
                  <button key={c} type="button" onClick={() => { setCover(c); setCoverImage(undefined); setPicker(false); }}
                    className={cx('w-full flex items-center gap-2 px-2 py-1.5 rounded-xl text-xs text-left cursor-pointer', cover === c && !coverImage ? 'bg-amber-950/60 text-amber-300' : 'text-slate-300 hover:bg-[var(--surface-hover)]')}>
                    <span className="w-10 h-6 rounded-md border border-slate-700" style={coverStyle(c)} />{COVER_NAMES[c]}
                  </button>
                ))}
                <button type="button" onClick={() => coverRef.current?.click()}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-xl text-xs text-slate-300 hover:bg-[var(--surface-hover)] cursor-pointer">
                  <ImagePlus className="w-4 h-4 mx-3" />Upload a cover…
                </button>
                <p className="px-2 pt-1 text-[10px] leading-4 text-slate-500">Covers show calligraphy, geometry, masajid or nature — no people or animals.</p>
                <input ref={coverRef} type="file" accept="image/*" className="hidden" onChange={e => { read(e.target.files?.[0], setCoverImage); setPicker(false); }} />
              </div>
            )}
          </div>
        )}
      </div>
      <div className="px-4 sm:px-8 pb-5 md:pb-6">
        <div className="flex flex-wrap items-end justify-between gap-4 -mt-11 md:-mt-14">
          <div className="relative">
            <div className="w-[88px] h-[88px] md:w-28 md:h-28 rounded-3xl p-1 shadow-xl" style={{ background: 'linear-gradient(135deg, var(--gold-leaf), var(--brand-green))' }}>
              {photo ? (
                <img src={photo} alt={name} className="w-full h-full rounded-[20px] object-cover bg-[var(--surface-panel)]" />
              ) : (
                <div className="w-full h-full rounded-[20px] flex items-center justify-center" style={{ background: 'var(--brand-green)' }}><RubElHizb size={60} /></div>
              )}
            </div>
            {editable && (
              <>
                <button type="button" title="Change profile picture" onClick={() => photoRef.current?.click()}
                  className="absolute -bottom-1 -right-1 w-9 h-9 rounded-xl bg-amber-500 hover:bg-amber-400 text-[var(--on-gold)] flex items-center justify-center shadow-lg cursor-pointer border-2 border-[var(--surface-panel)]">
                  <Camera className="w-4 h-4" />
                </button>
                <input ref={photoRef} type="file" accept="image/*" className="hidden" onChange={e => read(e.target.files?.[0], setPhoto)} />
              </>
            )}
          </div>
          {editable && (
            <div className="flex gap-2 pb-1">
              <button type="button" className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 text-xs font-semibold cursor-pointer hover:border-amber-500/50"><PenLine className="w-3.5 h-3.5" />Edit profile</button>
            </div>
          )}
        </div>
        <div className="mt-4 space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-[26px] md:text-[30px] leading-8 md:leading-9 font-semibold text-white">{name}</h1>
            <RoleBadge role={role} />
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-400"><MapPin className="w-3.5 h-3.5" />{location}</div>
          <p className="text-[15px] leading-relaxed text-slate-300 max-w-2xl">{bio}</p>
        </div>
        <div className="mt-4 md:mt-5 grid grid-cols-4 gap-2 md:gap-3">
          {stats.map(([k, v]) => (
            <div key={k} className="rounded-2xl border border-slate-800 bg-[var(--surface-inset)] px-2 md:px-4 py-2 md:py-3 text-center md:text-left">
              <div className="font-mono text-lg md:text-xl font-bold text-amber-300">{v}</div>
              <div className="text-[10px] md:text-[11px] leading-tight text-slate-400">{k}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

/* ---------- sidebars ---------- */
export type CommunityTab = 'foryou' | 'following' | 'questions' | 'verified' | 'halaqat';
export interface CommunityNavProps { tab: CommunityTab; onTab: (t: CommunityTab) => void; topic: string | null; onTopic: (t: string | null) => void; }
export const CommunityNav: React.FC<CommunityNavProps> = ({ tab, onTab, topic, onTopic }) => {
  const items: Array<[CommunityTab, string, React.FC<any>]> = [
    ['foryou', 'Home feed', House], ['following', 'Following', Users], ['questions', 'Questions', HelpCircle],
    ['verified', 'Verified Hadith', ShieldCheck], ['halaqat', 'Halaqat', CalendarDays],
  ];
  return (
    <aside className="space-y-5">
      <nav className="bg-[var(--surface-panel)] border border-slate-800 rounded-3xl p-2">
        {items.map(([id, label, Icon]) => (
          <button key={id} type="button" onClick={() => onTab(id)}
            className={cx('w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl text-sm font-semibold text-left cursor-pointer transition-colors',
              tab === id ? 'bg-amber-950/60 text-amber-300' : 'text-slate-300 hover:bg-[var(--surface-hover)]')}>
            <Icon className="w-4 h-4" />{label}
          </button>
        ))}
      </nav>
      <div className="bg-[var(--surface-panel)] border border-slate-800 rounded-3xl p-4 space-y-2">
        <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider text-slate-400"><Compass className="w-3.5 h-3.5" />Topics</div>
        <div className="space-y-1">
          {TOPICS.map(t => (
            <button key={t} type="button" onClick={() => onTopic(topic === t ? null : t)}
              className={cx('w-full flex items-center gap-2 px-2 py-1.5 rounded-xl text-[13px] text-left cursor-pointer',
                topic === t ? 'text-amber-300 bg-amber-950/50' : 'text-slate-300 hover:bg-[var(--surface-hover)]')}>
              <RubElHizb size={12} />{t}
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
};

export const CommunityAside: React.FC = () => (
  <aside className="space-y-5">
    <PatternSurface className="p-5 space-y-3">
      <div className="text-[10px] font-mono uppercase tracking-wider text-amber-300 flex items-center gap-2"><BookOpen className="w-3.5 h-3.5" />Ayah of the day</div>
      <div className="font-arabic text-[22px] leading-[40px] text-amber-200 text-center" dir="rtl" lang="ar">لَا يُكَلِّفُ ٱللَّهُ نَفۡسًا إِلَّا وُسۡعَهَا</div>
      <p className="font-serif italic text-[15px] text-slate-300 text-center">“Allah does not charge a soul except [with that within] its capacity.”</p>
      <div className="text-center text-[11px] font-mono text-amber-300">Al-Baqarah 2:286 · Saheeh International</div>
    </PatternSurface>
    <PatternSurface className="p-5 space-y-3">
      <div className="text-[10px] font-mono uppercase tracking-wider text-emerald-300 flex items-center gap-2"><ScrollText className="w-3.5 h-3.5" />Hadith of the day</div>
      <div className="font-arabic text-[19px] leading-[36px] text-amber-200 text-center" dir="rtl" lang="ar">مَنْ سَلَكَ طَرِيقًا يَلْتَمِسُ فِيهِ عِلْمًا سَهَّلَ اللَّهُ لَهُ بِهِ طَرِيقًا إِلَى الْجَنَّةِ</div>
      <p className="font-serif italic text-[15px] text-slate-300 text-center">“Whoever takes a path seeking knowledge, Allah makes easy for him a path to Paradise.”</p>
      <div className="flex justify-center gap-2 text-[11px] font-mono"><span className="text-amber-300">Sahih Muslim 2699</span><span className="text-emerald-400">· Sahih</span></div>
    </PatternSurface>
    <div className="bg-[var(--surface-panel)] border border-slate-800 rounded-3xl p-5 space-y-3">
      <div className="text-[10px] font-mono uppercase tracking-wider text-purple-300 flex items-center gap-2"><CalendarDays className="w-3.5 h-3.5" />Upcoming halaqat</div>
      {[['Tajwid for beginners', 'Sat · after Fajr'], ['Seerah: the Hijrah', 'Thu · after Maghrib'], ['Forty Hadith of an-Nawawi', 'Sun · after Isha']].map(([t, w]) => (
        <div key={t} className="flex items-center justify-between gap-2">
          <div><div className="text-sm font-semibold text-white">{t}</div><div className="text-[11px] text-slate-400">{w}</div></div>
          <button type="button" className="text-[11px] font-semibold text-amber-300 border border-amber-600/40 rounded-lg px-2 py-1 cursor-pointer">Join</button>
        </div>
      ))}
    </div>
    <div className="bg-[var(--surface-panel)] border islamic-gold-border rounded-3xl p-5 space-y-3">
      <div className="text-[10px] font-mono uppercase tracking-wider text-amber-300 flex items-center gap-2"><RubElHizb size={14} />Community adab</div>
      <ul className="space-y-2 text-[13px] text-slate-300">
        {['Share only the Qur’an, the Sunnah and beneficial knowledge.', 'Cite every ayah and hadith; unverified hadith are checked by the 6 agents first.', 'Fatwa questions are answered by verified scholars only.', 'No politics, mockery, backbiting or sectarian argument.', 'Speak with gentleness — “and speak to people good words” (Al-Baqarah 2:83).'].map(r => (
          <li key={r} className="flex gap-2"><Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" /><span>{r}</span></li>
        ))}
      </ul>
    </div>
  </aside>
);


/* ---------- phone-only pieces ---------- */
export const DailyAyahCompact: React.FC = () => (
  <PatternSurface className="px-4 py-3">
    <div className="flex items-center justify-between gap-3">
      <div className="text-[10px] font-mono uppercase tracking-wider text-amber-300 flex items-center gap-1.5 shrink-0"><BookOpen className="w-3.5 h-3.5" />Ayah of the day</div>
      <div className="text-[10px] font-mono text-amber-300">2:286 · Saheeh Intl.</div>
    </div>
    <div className="font-arabic text-[20px] leading-[36px] text-amber-200 text-center mt-1" dir="rtl" lang="ar">لَا يُكَلِّفُ ٱللَّهُ نَفۡسًا إِلَّا وُسۡعَهَا</div>
    <p className="font-serif italic text-[14px] text-slate-300 text-center">“Allah does not charge a soul except [with that within] its capacity.”</p>
  </PatternSurface>
);

const AdabNote: React.FC = () => (
  <div className="flex items-start gap-2 rounded-2xl border islamic-gold-border bg-[var(--surface-panel)] px-3 py-2.5 text-[12px] text-slate-300">
    <RubElHizb size={16} />
    <span>Religious knowledge only · cite every ayah and hadith · fatwa from verified scholars · no politics or backbiting.</span>
  </div>
);

/* ---------- CommunityHome — the three-column social page ---------- */
export interface CommunityHomeProps { language?: SupportedLanguage; initialTab?: CommunityTab; /** live verified-hadith feed from the app; replaces the sample feed */ verifiedFeed?: React.ReactNode; }
export const CommunityHome: React.FC<CommunityHomeProps> = ({ language = 'en', initialTab = 'foryou', verifiedFeed }) => {
  const [desktopPanels, setDesktopPanels] = React.useState(() => window.matchMedia('(min-width: 1024px)').matches);
  React.useEffect(() => {
    const query = window.matchMedia('(min-width: 1024px)');
    const update = () => setDesktopPanels(query.matches);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  const widgets = useCommunityWidgets(language, <CommunityAside />);
  const [tab, setTab] = React.useState<CommunityTab>(initialTab);
  const [topic, setTopic] = React.useState<string | null>(null);
  const [posts, setPosts] = React.useState<CommunityPostData[]>(COMMUNITY_POSTS);
  const [wall, setWall] = React.useState<any[]>(samples.wallPosts);
  let shown = posts;
  if (tab === 'questions') shown = posts.filter(p => p.kind === 'question');
  if (tab === 'halaqat') shown = posts.filter(p => p.kind === 'lesson');
  if (tab === 'following') shown = posts.filter(p => p.author.role !== 'Member');
  if (topic) shown = shown.filter(p => p.topic === topic);
  const tabs: Array<[CommunityTab, string]> = [['foryou', 'For you'], ['following', 'Following'], ['questions', 'Questions'], ['verified', 'Verified Hadith'], ['halaqat', 'Halaqat']];
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[240px_minmax(0,1fr)_300px] gap-6 items-start">
      <div className="hidden lg:block space-y-5"><CommunityNav tab={tab} onTab={setTab} topic={topic} onTopic={setTopic} />{desktopPanels && widgets.panel('left')}</div>
      <div className="space-y-4 md:space-y-5 min-w-0">
        {widgets.settings}
        {!desktopPanels && <details className="lg:hidden rounded-2xl border border-slate-700 p-3"><summary className="cursor-pointer text-sm font-semibold">{widgetText(language, 'tools')}</summary><div className="mt-3 space-y-5">{widgets.panel('left')}{widgets.panel('right')}</div></details>}
        <div className="lg:hidden -mx-3 px-3 flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
          {TOPICS.map(t => (
            <button key={t} type="button" onClick={() => setTopic(topic === t ? null : t)}
              className={cx('shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold cursor-pointer whitespace-nowrap',
                topic === t ? 'bg-amber-500 text-[var(--on-gold)] border-amber-500' : 'bg-[var(--surface-panel)] text-slate-300 border-slate-700')}>
              <RubElHizb size={11} />{t}
            </button>
          ))}
        </div>
        <div className="lg:hidden"><DailyAyahCompact /></div>
        {tab !== 'verified' && <div id="dd-composer" className="scroll-mt-20"><CommunityComposer onPost={p => setPosts(ps => [p, ...ps])} initialKind={tab === 'questions' ? 'question' : 'hadith'} /></div>}
        <div className="flex gap-1 overflow-x-auto bg-[var(--surface-panel)] border border-slate-800 rounded-2xl p-1" style={{ scrollbarWidth: 'none' }}>
          {tabs.map(([id, label]) => (
            <button key={id} type="button" onClick={() => setTab(id)}
              className={cx('flex-1 px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer whitespace-nowrap',
                tab === id ? 'bg-amber-500 text-[var(--on-gold)]' : 'text-slate-400 hover:text-slate-200')}>{label}</button>
          ))}
        </div>
        {topic && <StarDivider label={topic} />}
        <div className="lg:hidden"><AdabNote /></div>
        {tab === 'verified' ? (
          verifiedFeed ?? <PublicWallFeed posts={wall} currentLanguage={language} currentUser={samples.user}
            onLikePost={id => setWall(ws => ws.map(p => p.post_id === id ? { ...p, user_has_liked: !p.user_has_liked, likes_count: p.likes_count + (p.user_has_liked ? -1 : 1) } : p))}
            onAddComment={() => {}} onSelectPostForAnalysis={() => {}} onSharePost={() => {}} />
        ) : shown.length ? (
          shown.map(p => <CommunityPost key={p.id} post={p} />)
        ) : (
          <PatternSurface className="p-10 text-center space-y-2">
            <RubElHizb size={28} filled />
            <div className="font-display text-xl text-white">Nothing here yet</div>
            <p className="text-sm text-slate-400">Be the first to share beneficial knowledge on this topic.</p>
          </PatternSurface>
        )}
      </div>
      <div className="hidden lg:block">{desktopPanels && widgets.panel('right')}</div>
    </div>
  );
};
