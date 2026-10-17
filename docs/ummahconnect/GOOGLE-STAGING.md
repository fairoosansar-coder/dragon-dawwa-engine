# Separate Google staging OAuth setup

**Current state: 17 October 2026, 05:29 UTC.** Owner sign-in is confirmed in the task browser. The separate Google project is created; the OAuth consent configuration and Web client are **not yet created**. The main app remains offline. Production and Aishu are unchanged.

## Created project

- Name: **UmmahConnect Staging**
- ID: **`ummahconnect-staging-261017`**
- Number: **`677673398182`**
- Organization: **No organization**
- [Project console](https://console.cloud.google.com/home/dashboard?project=ummahconnect-staging-261017)
- No billing account was attached, service purchased, test user enrolled or native user/grant created by this operation.

After creation, Google returned to its previously selected Aishu dashboard. That existing project was **not edited**; the browser was explicitly switched to the exact new staging ID before any OAuth form work.

## Prepared draft — not submitted

| Setting | Staged value |
|---|---|
| Consent app name | UmmahConnect Staging |
| Audience | External; Google states it starts in Testing mode |
| User support email | `ferozansarlk@gmail.com` — authenticated owner contact only |
| Project-notification email | `ferozansarlk@gmail.com` — owner contact only |
| Google test users | None added |
| Final agreement | **Unchecked** |
| Final Create | **Not submitted** |

The owner's email is **not** treated as the author/reviewer/excluded designation. Those three actual account designations are still missing.

Google's final setup step requires the explicit agreement:

> I agree to the Google API Services: User Data Policy.

[Required policy](https://developers.google.com/terms/api-services-user-data-policy). Owner approval is required before checking this agreement and submitting the prepared configuration. Creating the separate project was already authorized and has succeeded; that approval is not requested again.

## Next authorized configuration

After agreement approval, finish only this new consent configuration, keep **External/Testing**, and create a **Web application** OAuth client for the exact callback:

`https://ummah-app-staging.up.railway.app/auth/callback`

Use only login scopes **`openid profile email`**. Client ID/secret belong only in protected settings for the isolated Railway `ummah-app` service. Never write secrets into Git, chat, source screenshots or public artifacts. No existing OAuth client, production service or Aishu project is to be changed; do not publish the consent app to production.

## Remaining account and acceptance gates

1. Owner approves the policy agreement above.
2. Finish/create staging consent and Web client; configure protected credentials.
3. Obtain three actual distinct Google emails: author; reviewer belonging to **another human**; login-permitted but community-excluded tester. No placeholders or inferred identity enrollment.
4. Observe genuine verified Google subjects and explicitly enroll permitted staging roles/native mappings. Author: submit only/no review; reviewer: review only/no submit; excluded: identity login only/no community membership/grant.
5. Deploy the qualified app from development ancestry and test actual Google login, persistent own pending submission, the different human's approve/reject, permitted approved visibility and negative access/revocation cases.
6. Execute the physical iPhone Safari plan; no device result exists yet.

The live native HumHub backend remains last verified at `66a1adb0052b56a0c094eb43ce0b1259bfc37a4f`, with private space/container 1/1, no users/posts/grants and initialization off. Native source/container/anonymous tests are not hosted human acceptance. The 33-screen design/status counts remain unchanged, and original 13-file recovery remains separate.

Evidence: `evidence/2026-10-17-google-staging/setup-state.json` and `project-created.webp`. Earlier dated native/project-uncreated records are retained as history; this current Google record supersedes their Google sign-in/project-creation blocker.
