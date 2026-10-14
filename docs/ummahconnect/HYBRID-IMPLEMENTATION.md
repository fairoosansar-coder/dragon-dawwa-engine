# UmmahConnect hybrid implementation

Decision: retain the 33-screen UmmahConnect application and Dragon Dawwa knowledge engine. Adopt focused services through server-side adapters. HumHub is the sole social system of record. Existing authentication remains the identity authority; application and provider IDs are mapped server-side.

## Selected stack and responsibilities

| Component | Role | Onboarding state |
|---|---|---|
| Existing React app and Dragon Dawwa | Premium interface, Quran/Tafsir, dossiers, prayer and Gemini voice | Existing integration retained |
| humhub/humhub + humhub/rest | Members, spaces, posts and supported social actions | Read adapter exists; runtime, trusted session mapping and writes pending |
| qdrant/qdrant | Permission-filtered semantic and lexical retrieval index | Selected; not installed |
| BAAI/bge-m3 | Multilingual dense/sparse document embeddings | Evaluation candidate; no weights downloaded |
| BAAI/bge-reranker-v2-m3 | Rerank retrieved passages | Evaluation candidate; no weights downloaded |
| docling-project/docling | Parse PDFs, scans and tables into reviewable source material | Selected; not installed; Arabic manuscript accuracy unqualified |
| Chocobozzz/PeerTube | Internal lecture library, recorded video and broadcast streams | Later phase; no instance or federation configured |
| Existing application business backend | Mosque approvals, finances, project milestones, donation reconciliation | Extend existing data model after auth/schema reconciliation |

Users see one UmmahConnect interface and one login. Backend services are separately hosted, with separate credentials and storage boundaries. Do not copy their databases into the app or expose administrative provider tokens to browsers. Persistent PHP services and model/document workers cannot run inside the current frontend staging Worker. The current workspace has no PHP or Docker executable; service activation needs a separate isolated runtime target.

## Implementation order and exit criteria

1. Identity and real social activity: reconcile the existing deployed OIDC/session contract; provision an isolated compatible HumHub + REST pair; map two test members with different permissions. Show real spaces and posts in screens 4/11/12. Then implement scoped publishing, comments, reactions, profiles, following and notification adapters where the installed module API supports them. Unapproved public content must not appear in feeds, search or direct URLs. Test sign-out/revocation, forbidden spaces, human approval, uploads and deletion. Messaging needs its own supported module/API check.
2. Knowledge retrieval: ingest licensed approved source editions, with original text, document hash, page/reference, language, access scope and reviewer status. Docling extraction stays draft until checked. Index only approved searchable material; filter by permissions before retrieval. Use BGE embeddings with Qdrant hybrid retrieval and the reranker, then pass the source packet into the existing strict evidence pipeline. Preserve scholarly disagreements and exact citations; a relevance score is never a Hadith grade. Test Arabic, English, Sri Lankan Tamil and Sinhala independently against a human-labelled set, including no-answer cases. Retain the current research/voice provider until an alternative beats its measured quality and cost.
3. Lectures and halaqat: add PeerTube behind the existing UI and account permissions. Test upload, processing, thumbnails, captions, stream playback, signed/private access and mobile Safari. Restrict federation/public discovery until explicitly configured. PeerTube broadcasts do not supply a multiparty interactive classroom; assess that separately if needed. Keep recorded scholars distinct from generated podcast voices.
4. Charity and mosque projects: connect project registry, Current Site documents, Proposed Design versions, committee-approved Construction milestones, Finances ledger and Donations. Use an established payment provider SDK once the legal receiving entity and merchant account are selected. Implement server-created payments, signed callbacks, idempotency, reconciliation and receipts. Models cannot authorize finances or certify construction. Do not insert illustrative records into live ledgers.
5. Complete remaining event, volunteer, organization and marketplace workflows. Reuse HumHub modules where their APIs and permissions meet requirements. Add an independent commerce engine only if real multi-vendor ordering is required; do not carry that operational burden for a business directory.
6. Run end-to-end acceptance through the actual staging login and real iPhone Safari. Review performance, backups, restore, upgrades and rollback before any production approval.

## Compatibility and licensing

On 2026-10-13 GitHub's HumHub latest release endpoint returned v1.19.0, while humhub/rest returned v0.11.7. The official REST marketplace lists 0.12.4 for HumHub 1.19+. Do not combine independent latest tags. Obtain the correct release artifact, verify its published hash and module manifest, pin an immutable revision/digest, and test that exact pair. Source discovery is not deployment qualification.

Review each selected version's licence and module terms before distribution. HumHub and PeerTube have AGPL licensing considerations; some HumHub modules are paid. Qdrant is Apache-2.0; Docling's code is MIT, with model dependencies reviewed separately. BGE-M3's model card lists MIT; bge-reranker-v2-m3 lists Apache-2.0. Source content and translations have separate reuse rights. No licence choice or model-language quality is assumed from a repository's popularity.

Do not add Mastodon or a second complete social backend alongside HumHub. Discourse can be reconsidered for a distinct advanced forum requirement, but it is not needed for the first community release. Do not add a second authentication authority or a duplicate editorial CMS while the existing auth/editorial services can meet the requirement. Do not repurpose Aishu's active GPU runtime for these workers.

## Status of this onboarding pass

Repository/model selection, upstream release discovery, service ownership and acceptance criteria are prepared. New services and model weights are NOT installed, deployed, benchmarked or connected. Existing production and staging runtimes remain unchanged. upstream-register.json records discovery evidence, not a deployment lockfile. The first executable milestone is an isolated HumHub service plus existing-account linking, not another visual redesign.

## Primary sources

- https://github.com/humhub/humhub
- https://github.com/humhub/rest
- https://marketplace.humhub.com/module/rest/downloads
- https://docs.humhub.org/docs/adminuser/modules/
- https://github.com/qdrant/qdrant
- https://qdrant.tech/documentation/search/text-search/hybrid-search/
- https://huggingface.co/BAAI/bge-m3
- https://huggingface.co/BAAI/bge-reranker-v2-m3
- https://github.com/docling-project/docling
- https://github.com/Chocobozzz/PeerTube
