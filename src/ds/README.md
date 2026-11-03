<!-- Brand book for the Islamic redesign. The live design system (with every page and component card) is the Dragon Dawwa design-system artifact; this copy travels with the code. -->

Dragon Dawwa is a scholarly hadith-authentication engine: six AI agents trace a narration through its sources, chain, narrators, corroborating texts and the verdicts of the classical critics, then grade it. The interface should feel like stepping into a **quiet masjid at night, or opening an illuminated Mushaf**. It should be calm, reverent and easy on the eyes, with gold reserved for what is precious.

## Principles

- **Aniconic, always.** Decoration is geometry, architecture and script: the 8-point Khatam star lattice, the rub el hizb (۞), the mihrab arch, Arabic calligraphy. Never people, animals, faces or mascots, and no photography as background.
- **Stillness over excitement.** Soft contrast, generous spacing, slow transitions. No neon, no glitter gradients, no flashing (the only pulse is the ON AIR dot).
- **Gold is earned.** `gold-leaf` and the gold scale mark what is precious: the Basmala, the verdict, the primary action. They are not filler.
- **Sacred text gets room.** Arabic matn is set large in `arabic`, right-to-left, with loose leading and space around it. It is never truncated mid-ayah or mid-hadith.

## Themes

Two themes share every component:

- **Night Masjid** (`night`, default): deep green-black grounds (`surface-*`), soft ivory text (`color-white`, `text-body`), antique gold. For long reading sessions and evenings.
- **Mushaf** (`mushaf`): ivory parchment grounds, deep mushaf-green headings (`color-white` becomes #123a2e), umber body text, illuminated gold. For daylight and printing.

`color-*` tokens drive Tailwind's palette. Neutrals (`color-slate-*`) and every hue scale flip in Mushaf, so a dark badge such as `bg-emerald-950 text-emerald-300` automatically becomes a light badge with dark text. Write components once with the night scale and they work in both themes.

## Colour

- **Surfaces, darkest to lightest by night:** `surface-body` → `surface-app` → `surface-sunken` / `surface-well` → `surface-inset` → `surface-header` → `surface-modal` → `surface-panel` → `surface-raised` → `surface-hover`. By day the order is reversed toward ivory. Borders are `color-slate-800` (a parchment rule by day).
- **Gold:** `color-amber-500` fills primary actions with `on-gold` text (7.0:1 night, 6.2:1 Mushaf). `color-amber-400` is for icons and `color-amber-300` for gold text. `gold-leaf` inks every ornament, and `gold-border` / `gold-glow` / `shadow-gold-glow` gild featured surfaces.
- **Green:** `brand-green` is the deep Islamic green for brand blocks. The emerald scale carries authenticity.
- **Grades keep fixed hues.** Never use these colours as decoration:
  - Authentic (Sahabi, Thiqah, Sahih) → emerald
  - Sound (Hasan) → teal
  - Acceptable (Saduq) → cyan
  - Weak / contested (Da'if) → gold/amber
  - Rejected / fabricated (Matruk, Mawdu') → rose
  - Implicit transmission ('an'anah) → purple
  - The purity gauge uses `purity-sahih`, `purity-hasan`, `purity-daif` and `purity-mawdu`.
  Pair every grade colour with its word, and with its Arabic term where the app shows one.
- **Text contrast on `surface-panel`:**
  - `color-slate-400` (captions): 6.8 night / 8.2 Mushaf
  - `color-slate-500` (meta, 12px and up): 4.7 / 6.2
  - `color-slate-600`: 2.6 / 4.1. Use it for dividers and disabled states, not text.
- **Scrims** use `color-black`: true black by night, warm umber by day.

## Type

- `display`: Cormorant Garamond, a calm classical serif. Used for the `wordmark` (uppercase, 0.14em tracking), `banner-title` and `display-title`.
- `sans`: Outfit, for all UI. `body` is 15/26 for report prose, `body-xs` (12px) for controls and `meta` (11px) for subtitles.
- `serif`: Cormorant Garamond italic, for translated quotations (`quote`).
- `arabic`: Amiri Quran, then Scheherazade New. Used for the `bismillah` (34px), `matn-arabic` (24/42) and `arabic-body` (18/36). Always `dir="rtl"`, and tint it `color-amber-200`/`color-amber-300` (gold) or `color-emerald-200` (green).
- `kufi`: Reem Kufi, a geometric Kufic face for Arabic headings (`kufi-heading`). Use it at 20px and above only; smaller Arabic goes in `islamic` (Amiri).
- `islamic`: Amiri, for small inline Arabic (`arabic-caption`).
- `mono`: scores, uppercase `label`s, `tag`s and chains written "A -> B -> C".
- All faces load from Google Fonts via `src/index.css + src/ds/theme.css`.

## Ornament and backgrounds

- **Star lattice:** every page ground carries the Khatam 8-point star lattice in `gold-leaf` at 9% (night) / 14% (Mushaf). This comes from the body background; it is not an image file. `PatternSurface` and `.islamic-pattern-bg` use a denser version for callouts.
- **ArchBanner:** the hero banner is a mihrab arch with a double gold outline, crowned by a rub el hizb and opened with the Basmala. Use one per screen at most.
- **IlluminatedFrame:** a gilded double border with corner rosettes, reserved for the verdict and canonical text.
- **StarDivider:** replaces plain rules between sections.
- **RubElHizb:** the ornament glyph, used for bullets, rosettes and loading.

## Space, shape, depth

- Spacing follows a 4px scale: `space-2` inline, `space-3` between cards, `space-4` card padding, `space-6`–`space-8` panel padding. Leave more air around Arabic than around Latin text.
- **Radii:** `radius-xl` for controls, `radius-2xl` for cards, `radius-3xl` for panels and modals, `radius-full` for pills. The arch is the only pointed shape.
- **Depth:** soft, low shadows (warm umber by day), with `shadow-gold-glow` for featured surfaces. The header and modals use a 90% surface with backdrop blur.
- **Gradients are rare:** the `run` button (gold → emerald), the brand tile, active mode cards, and the faint gold glow at the top of patterned surfaces.

## Voice and content

- Use classical terms with an English gloss: "Da'if / Contested or Deficient", "Hasan / Sound". Quote Arabic in Arabic script beside its translation.
- Open banners and reports with the Basmala, in Uthmani spelling (بِسۡمِ ٱللَّهِ ٱلرَّحۡمَٰنِ ٱلرَّحِيمِ). Say "the Prophet ﷺ" with the salawat, as the source data does.
- Name the authorities behind each verdict (Tahdhib al-Kamal, Mizan al-I'tidal, the Kutub al-Sittah).
- The app is trilingual (English, தமிழ், සිංහල); the `LanguageToggle` always sits in the header.
- Use Title Case for headings and buttons, and UPPERCASE only in mono `label`/`tag`. No emoji except language flags.

## Iconography

- Use **lucide-react** stroke icons for actions: 14px in buttons, 20px in tiles, tinted `color-amber-400`, or the grade colour for status icons.
- Use `RubElHizb` for ornament, never lucide stars or sparkles.
- The brand mark is the Flame in the gold-to-emerald tile (`BrandMark`). The repository has no logo file.

## Community — the heart of the app

Dragon Dawwa is first a **community for sharing and learning the deen**; verification and the studio serve it. The app opens on Community (`PageCommunity`, `DragonDawwaApp` default mode `wall`). The header menu lists it first, then Verify a Hadith and Live Studio. Community has no hero banner: it opens on the member's `ProfileHeader`, with a cover banner (Star lattice, Mihrab or Mushaf gold, or an uploaded image) and a profile picture (an uploaded photo, or the gold rub el hizb by default). Profile stats count learning (Shared, Questions asked, Halaqat joined, Hadith verified), not followers.

- **Only the deen.** Posts are typed — Reflection, Ayah, Hadith, Question, Du'a, Halaqah — and topics are the sciences of the religion (`TOPICS`: Qur'an & Tafsir, Hadith, Aqidah, Fiqh, Seerah, Akhlaq & Adab, Du'a & Dhikr, Arabic). There is no general-purpose post type.
- **Sources are mandatory** for Ayah and Hadith posts; a Hadith can be sent through the 6-agent engine before it appears, and verified ones carry their grade.
- **Questions are answered by verified scholars.** Anyone may ask; the highlighted answer comes from a Verified Scholar or Teacher, otherwise the post shows "Awaiting an answer from a verified scholar".
- **Reactions are courtesy, not popularity:** JazakAllahu khayran (Ameen on a du'a), Beneficial, Discuss/Answer, Save for study. No follower counts or like totals on profiles.
- **Adab is visible** in the composer and the right column: religious knowledge only, cite sources, fatwa from verified scholars, no politics, mockery, backbiting or sectarian argument; Report on every post.
- **Daily nourishment:** Ayah of the day, Hadith of the day (with grade) and upcoming halaqat sit beside the feed.

Components: `ProfileHeader`, `CommunityHome` (three columns), `CommunityNav`, `CommunityComposer`, `CommunityPost`, `CommunityAside`; the Verified Hadith tab shows the engine's `PublicWallFeed` dossiers.

## Quran

The Quran is the second mode, with five pages: Home · **Read** (the e-book) · **Search** · Ayah Study · My Quran (header menu: Community · **Quran** · Verify a Hadith · Live Studio; phone tab bar: Community · **Quran** · Share · Verify · Studio, with your profile behind the avatar in the phone header). `QuranApp` has four pages under a sub-menu:

- **Home:** Continue reading, Ayah of the day, Khatm progress, and all 114 surahs (search, Surah / Juz).
- **Reader:** the illuminated surah title, named **translation** and **reciter** selectors, Arabic size, a translation toggle, ayah cards (play, bookmark, note, study, copy), and the **Sources** drawer.
- **Ayah Study:** the ayah (tap any word), word by word with transliteration and root letters, **tafsir** from Quran.ai (al-Muyassar, Tazkirul Quran, Ibn Kathir, al-Sa‘di), **Compare translations** (up to three), a *Grounded with Quran.ai* line, contextual **study questions** (reflections save to notes), and **Explanations & podcasts**.
- **My Quran:** Bookmarks, Notes, Submissions (with review status) and Progress.

Rules:

- **The Qur'an is quoted exactly.** The Arabic is the Uthmani Hafs text (King Fahd Complex print, via QuranEnc in `quran-json` 3.1.2) and matches the Quran.ai reader word for word. The offline English is Saheeh International (Tanzil revision); where Quran.ai text is present it is used instead (quran.com's current revision, e.g. 1:7 *earned [Your] anger*). They load from `data/quran-en.json`, with Al-Fatihah and Al-Ikhlas built in. Madani page, juz and sajdah for every ayah come from `quran-meta` (King Fahd Complex data, MIT). Never retype an ayah; take it from the data.
- **Arabic** is `font-arabic`, `dir="rtl"`, ending with the ayah mark ۝ and Arabic-Indic digits (`AyahMark`). Interface text follows the header language: English, Tamil or Sinhala (`QURAN_STRINGS`).
- **Every translation is named**, with its translator under the text and a quran.com citation. English editions come from Quran.ai: Saheeh International, Abdel Haleem, Taqi Usmani, al-Hilali & Khan, Yusuf Ali, Pickthall. Tamil and Sinhala editions are not in the Quran.ai catalogue yet; they stay in the selector, marked as such, and open the unavailable state. The Arabic is never hidden.
- **Use the states:** `QuranState` loading (skeleton and a turning rub el hizb), unavailable (cloud-off, original-source link, an alternative) and error (Try again). Use them for surahs, translations, tafsir, word by word and audio.
- **Human review:** member explanations and podcasts show **Awaiting human review** (`ReviewStatusChip`) and are not visible to others until approved.
- **Core reading and study stay inside Dragon Dawwa.** "Open original source" links are optional, always marked with ↗, and live in the Sources drawer and the unavailable states.


### The Quran.ai reader standard

The connected Quran.ai reader (mcp.quran.ai, data from quran.com) sets the bar for reading and study:

- **Select an ayah, a word or a phrase** (`SelectBar`). In Word mode a tap opens `WordSheet`: the word, transliteration, meaning, **root letters** with how many words and ayat use the root, the **dictionary form** and its uses, the **parts of the word** (prefixes, pronouns), and a grammar note — then Listen, Study, Search this word and Copy. Phrase mode: tap the first word, then the last.
- **Reader settings** (`ReaderSettingsPanel`, in the Display menu): turn by page or by ayah, word meanings under the Arabic, navigation arrows on the book's edges, keep the selected ayah open, select the first ayah of each page. The ayah panel has its own previous / next ayah buttons.
- **Grounded, never from memory.** Every translation, tafsir passage and word analysis is Quran.ai data (`quranGrounded.ts`, fetched 2026-10-10) and carries a *Grounded with Quran.ai* line naming the calls, plus quran.com links. In the app it is requested live; the previews include Al-Fatihah (all of it) and Al-Ikhlas, and other ayat show the “loads live from Quran.ai” state.
- **Word glosses are English** (Quran.ai has no Tamil or Sinhala word-by-word); the interface around them follows the header language.

`DragonDawwaApp` renders the whole app: `AppHeader` (BrandMark, the Community · Verify a Hadith · Live Studio menu, LanguageToggle, user; Share / Copy / PDF only on Verify), then the `ProfileHeader` on Community or an `ArchBanner` on Verify (full) and Studio (compact), the search form on Verify, the mode's content, and `AppFooter` (StarDivider, رَبِّ زِدْنِي عِلْمًا — Ta-Ha 20:114, credit and disclaimer). Page cards: `PageCommunity` (home), `PageDossier`, `PageDossierVerdict` (the verdict in an IlluminatedFrame) and `PageStudio`, laid out at 1280px.

## Phone

Below the `md` breakpoint the app becomes a phone app (cards in the **Phone** group):

- **Header:** the wordmark on one line, the language toggle as EN / TA / SI, and your avatar (opens your profile).
- **`MobileTabBar` at the bottom:** Community · Quran · **Share** (a raised gold eight-pointed star in the middle) · Verify · Studio. Share jumps to the composer. The bar respects the phone's safe area.
- **Community** becomes one column: profile, swipeable topic chips, a compact Ayah of the day (`DailyAyahCompact`), the composer, a one-line adab note, swipeable feed tabs, then posts. The desktop side columns fold away.
- **Banners shrink:** arch banner titles drop to 30px and the Basmala to 26px. The profile cover is 160px tall, with an icon-only cover button.


- **Pages** (new): `DragonDawwaApp`, `AppHeader`, `ModeTray`, `AppFooter`, `VerdictReport`, `DossierPage`, `StudioPage`, `WallPage`
- **Quran e-book** (new): `QuranBook`, `AyahSheet`, `QuranSearch`, `ShareAyahSheet`, `normaliseArabic`, `juzOfPage`
- **Quran.ai reader standard** (new): `WordSheet`, `WordText`, `WordStrip`, `SelectBar`, `ReaderSettingsPanel`, `TranslationCompare`, `TafsirPanel`, `Grounding`, `trTextFor`, `QURAN_AI_TRANSLATIONS`, `QURAN_AI_TAFSIR`, `GROUNDED_TR`, `GROUNDED_TAFSIR`, `GROUNDED_WORDS`
- **Quran** (new): `QuranApp`, `QuranProvider`, `QuranHome`, `QuranReader`, `AyahStudy`, `MyQuranCollection`, `AyahCard`, `AyahMark`, `QuranAudioPlayer`, `SourcesDrawer`, `QuranState`, `ReviewStatusChip`, `TranslationSelect`, `ReciterSelect`, `QuranSubNav`
- **Phone** (new): `MobileTabBar`, `DailyAyahCompact`
- **Community** (new): `ProfileHeader`, `CommunityHome`, `CommunityNav`, `CommunityComposer`, `CommunityPost`, `CommunityAside`
- **Ornaments** (new): `ArchBanner`, `IlluminatedFrame`, `PatternSurface`, `StarDivider`, `RubElHizb`
- **Brand:** `BrandMark`, `LanguageToggle`, `ModeCard` (the original app's tab cards; the pages now use the header menu)
- **Actions:** `Button` (`run`, `gold`, `solid`, `share`, `secondary`)
- **Badges:** `MonoTag`, `NarratorBadge`, `TransmissionBadge`, `PurityBadge`
- **Layout:** `Panel`
- **Agents:** `AgentStatusTracker`, `TakhrijView`, `IsnadDiagram`, `RijalDossier`, `ShawahidMatnView`, `ScholarsVerdictMatrix`
- **Screens:** `DashboardVisualization`, `HistoricalVariationsChart`, `HadithSearchForm`, `PodcastScriptPlayer`, `PublicWallFeed`, `ShareModal`, `HadithMediaUploadModal`

The bundle exposes `window.DragonDawwa`, including `DragonDawwa.samples` (the repository's sample analysis, presets, wall posts and user). Styling is Tailwind v4; `src/index.css + src/ds/theme.css` is the compiled stylesheet with both themes.

## Not synced

- **The redesign is ahead of the repository.** Palette, fonts, star-lattice backgrounds and the ornament components exist only here. To make the screens themeable, this system's copy of the app components swaps their hard-coded surface hexes for `surface-*` variables and swaps `text-slate-950` for `on-gold`. Bringing the redesign to the live app means applying the same changes to `src/index.css` and the components.
- **Logos, icon files, font files:** none exist in the repository.
- **Quran, not yet licensed or wired:**
  - The named translations other than Saheeh International (The Clear Quran, Hilali & Khan, Abdul Hameed Baqavi, Jan Trust Foundation, Ruwwad Translation Center) and the two tafsir show the unavailable state until their availability and licences are confirmed.
  - Word by word and the study note exist only for 1:5.
  - Audio is simulated timing in previews.
  - Tamil and Sinhala interface text needs native-speaker review.
- **Community back end:** posting, scholar verification of accounts, answers, moderation and reports need a server and database the repository doesn't have yet; the Community design runs on sample posts (fictional people, real references).
- **Live behaviour** (analysis, OCR, TTS, wall publishing) needs the app's Gemini server. Previews show sample data, and remote avatar photos are replaced by an aniconic star mark.
- Components are compiled for React 18; the app targets React 19 but uses no 19-only APIs.
