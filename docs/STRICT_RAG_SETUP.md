# Dragon Dawwa v2.5 strict RAG and provider setup

## Status

Implemented Python CLI, not deployed or connected to the existing Express/Vite
`/api/analyze` route. The existing TypeScript engine and legacy studio script still
use their previous implementation. Do not describe their outputs as strict RAG.
The new CLI has no memory/sample fallback. No credentials were found in this
workspace, and no authenticated provider request has been tested.

## Backend environment

Configure these in the deployment's protected environment settings:

- `SUNNAH_API_KEY`
- `GEMINI_API_KEY`
- `GEMINI_MODEL` (an enabled model in your Google project)
- `QURAN_CLIENT_ID`
- `QURAN_CLIENT_SECRET`
- `QURAN_ENV=production` for approved production credentials, otherwise `prelive`

`.env.example` contains empty placeholders. Never use `VITE_` credential names.
Python scripts read the process environment, not `.env` automatically. Do not
paste credentials into CLI arguments, code, reports, chat or public screenshots.

## Sunnah search blocker

The official specification inspected on 10 October 2026 documents collections,
individual hadith retrieval and filtered lists, but does not document the requested
`https://api.sunnah.com/v1/hadiths/search` route or its query parameter.

The adapter targets that exact URL, but requires
`SUNNAH_SEARCH_CONTRACT_CONFIRMED=1` and `SUNNAH_SEARCH_QUERY_PARAM` only after the
provider confirms the route, parameter and response envelope. Do not set the flag
just to bypass the check. The parser accepts `data[]` containing the documented
Hadith fields: collection, hadithNumber, hadith[].lang/body/grades. If the actual
search schema differs, update and test the adapter; do not guess or scrape.
The packet covers the returned page only, not an exhaustive corpus search.

## Commands (Python 3.10+, standard library only)

```sh
python provider_onboarding.py
python provider_onboarding.py --live
python sunnah_api_tool.py "Your fuzzy hadith query"
python dragon_dawwa_core.py "Your fuzzy hadith query" --host-name "Feroz"
python -m unittest discover -s tests -p 'test_strict_rag.py' -v
```

The default onboarding command checks configuration presence only. `--live`
checks the documented Sunnah collections endpoint, Quran OAuth + chapter
catalogue, and a small billable Gemini JSON response. Successful Sunnah key
validation does not validate fuzzy search. Credentials and tokens are not printed.

The Quran client uses server-only OAuth client credentials, a cached token,
one renewal/retry after HTTP 401, and the environment-specific Content API.
It currently exposes `get_chapters`; it does not yet replace the frontend Quran
reader's data source or implement Quran.ai study, translation selection or audio.

## Verification contract

Agent 0: optimize query only, fetch live JSON, normalize text/grades, retain source
references and timestamps, hash packet and records. Fetch/configuration/empty
result failures stop the pipeline with a hard error and nonzero CLI exit.

Agents 1–5: five separate Gemini calls. Only exact full-field quotations and named
source grades can be accepted. The documented packet has no typed chain,
biographical or defects evidence, so Agents 2–4 must return `not_found`.

The synchronous gate rejects invented IDs, modified quotations, added fields,
unsupported agent claims and unattributed grades. It checks that all retrieved
grades for accepted records are preserved, including disagreements.

Agent 6 receives accepted claims only. It produces an ordering/speaker plan using
claim IDs. The gate validates that every accepted claim appears exactly once in
each report/script, then deterministic code renders the text. No generated factual
paraphrase, translation, independent authenticity score or grading is permitted.
The host's profile name is inserted as a display label, never as a scholar identity.

This verifies traceability to retrieved evidence, not the historical truth,
completeness or relevance of a source. Hashes are integrity checks, not signatures;
never accept a client-supplied evidence packet as authoritative. Output status is
`awaiting_human_review`; no publication, TTS call, database workflow or UI review
queue is implemented by these scripts. Script audio generation is separate.

## Verification

18 offline tests passed, including end-to-end mock orchestration, retrieval failure,
false citations/graders, altered quotes, omitted evidence, synthesis injection,
packet tampering, provider status redaction and Quran token caching.
No live provider integration is claimed. No changes deployed.

## Official references

- https://github.com/sunnah-com/api/blob/master/spec.v1.yml
- https://api-docs.quran.com/docs/quickstart/
- https://ai.google.dev/api/generate-content
