# Dragon Dawwa — implementation and progress, 12 October 2026

This record covers `dragon-dawwa-engine`, branch `integration/design-engine`. It does not certify the separate Railway deployment or the original ChatGPT Site.

## Completed in this repository

- Integrated the Islamic design components with the working React application.
- Quran reader with Arabic text, existing translation choices, navigation and study views.
- Real recitation playback through UmmahAPI metadata, with reciter selection, play/pause and playback controls; no synthetic Quran recitation fallback.
- In-page word meanings and four tafsir editions through server routes: Muyassar, Ibn Kathir (English abridged), Ma’arif al-Qur’an, and Ibn Kathir Arabic. Tested live verse 5:114 returned 22 words and all four commentaries.
- Source failures show retry states. Server API keys are kept out of client requests.
- Gemini podcast speech with named voice selection. Removed automatic browser system-speech fallback; errors remain visible.
- Research submit is wired to `/api/analyze`; added a visible request status and timeout handling, removed manufactured/sample fallback dossiers on server failure, and passed language selection through the Vite route.
- User reported the preview working after saving Gemini and Ummah keys. This is user confirmation, not an independent live credential test in this workspace.

## UI redesign in this update

- Community now opens with a saturated emerald welcome area, gold call to action, geometric detail and direct Quran / Hadith Research / Podcasts cards.
- Large profile header moved behind Me so the community feed has priority.
- Phone/tablet navigation: Community, Quran, Hadith Research, Podcasts, Me. Sharing is accessible from the welcome area and existing composer.
- Warm ivory default for new visitors; existing saved theme preference preserved. Night theme has stronger emerald surfaces.
- Report actions moved into a separate wrapping toolbar; copy, export, print and share retained.
- English, Tamil and Sinhala labels for new navigation and welcome content.
- Sample community content labelled as a preview. Removed misleading scholar-certification claims from the shell copy.

## Important unfinished work

- Hadith research still uses the legacy Gemini generation route. The strict Python retrieval / citation-verification scripts exist separately and are NOT wired into the live `/api/analyze` endpoint. A generated report is not independently authenticated scholarship.
- Community feed, profile details, counts and several social interactions remain sample/local UI state. Production signup, persistent user profiles, real following, notifications, discussion storage and role management need implementation in this repository.
- Human review before public wall publication is NOT enforced by this engine's current backend. Do not treat its wall as an approved public publishing workflow.
- The original Site's v8 administration/editorial implementation is separate; it has not been migrated into this engine.
- Tamil and Sinhala UI do not imply complete translated content. New word meanings are English; connected tafsir editions are Arabic/English. Human language/editorial review remains needed.
- Charity, mosque construction pages, donations and a production moderation dashboard are not completed here.
- No production release, DNS change, Railway setting change or secret migration is included in this redesign.

## Next product work

Connect live research to the retrieved-evidence verification pipeline; then build persistent profiles and the admin review/publishing queue. Extend the shared design to charity and mosque pages as working flows, with clear separation between design previews and real data.

## Verification for this UI update

TypeScript and the Vite production build passed. `git diff --check` passed. Browser visual and interaction checks could not run: the Playwright browser binary was unavailable and its download returned an invalid archive. Mobile appearance and navigation therefore require a preview check; they are not claimed as visually certified. No paid API calls were made for this design update.
