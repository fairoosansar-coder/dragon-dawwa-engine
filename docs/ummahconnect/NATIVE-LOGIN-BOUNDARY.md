# Native HumHub login boundary repair — 17 October 2026

The reported `https://ummah-humhub-staging.up.railway.app/user/auth/login` error was reproduced as HTTP 500 with verified TLS. Scoped error metadata identified `yii\base\InvalidConfigException: Unable to locate message source for category 'yii/bootstrap5'`, in the pinned Bootstrap-compatible Alert close label. This is a native browser-page defect, not a failed Google callback or proof that native passwords should be enabled.

A separate scoped filesystem observation established that the active `/var/www/html/protected/runtime` was a materialized ordinary directory rather than the planned private-volume symlink; its cache directory was root-owned. Cron's repeated file-cache write warnings were real. The exact process that materialized the directory has not been established.

## Narrow correction

`configure-humhub.php` explicitly configures the supported Yii `runtimePath` to `/var/lib/ummah-humhub/runtime` and creates its cache root with private mode 0700 and www-data ownership. It explicitly registers the pinned Bootstrap 5 Gettext message source at the stable vendor messages directory. Existing exact project/environment/database-role guards, private config mode 0600, URL manager, log context suppression and upload/private-path protections remain unchanged. Yii uses its own MO/PO parsers; no unnecessary gettext PHP extension or upstream-version change is introduced.

The enabled review module registers a web-only before-request handler denying the exact `user/auth` route family, across pretty URLs and the configured query route parameter. Native password, registration and external-browser auth return explicit **403**, with **no-store** and a message directing users to the UmmahConnect application. Malformed non-string route selectors fail with 400 instead of warnings/500. Bearer `/api/v1/auth/current` and review endpoints are not native browser login and remain under their existing authentication/grant enforcement.

The main application remains the sole existing Google authority. Do not add native passwords/Google clients or enable registration to make the backend URL look like a working main app.

## Qualification contract

Fresh source validation: **47 app + 19 isolated identity** tests pass; TypeScript lint/build and PHP/shell lint pass. A database-free pinned-framework check resolves/translates the exact message category and verifies **8 native route cases**, including bearer-path exclusion. An initial incorrect identity glob ran zero tests and was not accepted as evidence; the actual `deployment/staging/identity/test.mjs` runner was then executed with all 19 passing.

New disposable container qualification must pass before hosted replacement. It includes native browser denial/no-store/message checks, malformed selector rejection and unchanged anonymous bearer 401; a forced materialized docroot runtime/root-cache condition; **11 standard private-runtime/cache/translation/Alert checks** as www-data; unchanged native HTTP/model moderation, independent-review and restart tests. Synthetic fixture/DB/model helpers run as www-data after startup so qualification itself cannot create root-owned application caches. The probe refuses non-container/unflagged use and never creates accounts/content/grants.

**Current status at source submission: NOT YET CI-qualified or deployed.** Preserve both private databases, volumes, private community ID 1, zero real users/memberships/grants, and initialization=no. Do not run fixture scripts or this CI-only probe against Railway. Hosted read-only operator checks that bootstrap Yii must use `runuser -u www-data -- php ...`; never use root Yii diagnostics after service startup to create new root-owned cache branches.

## Hosted acceptance for this repair

After exact new native CI success, change only the native staging source branch with successful-CI gating and deploy one replacement image. Verify the exact deployed source, intentional native login/query/POST denial, anonymous bearer and private-storage denial, effective private runtime alias and read/write cache as www-data, worker status, unchanged private community/counts and initialization=no. Use only owned non-sensitive transient cache sentinels; remove them and temporary diagnostics. Capture a redacted screenshot of the intentional denial, not a claimed Google login or human review.

The 33-screen interface and its 6 locally Working / 20 UI Only / 7 Blocked matrix remain unchanged. No real Google role enrollment, independent human review or physical iPhone Safari result is supplied by this repair. The actual author, different-human reviewer and excluded tester email designations remain required. Production, Aishu and original-file recovery are excluded.
