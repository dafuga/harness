# Project Reports in Harness

This app is the `packages/reports` workspace in the Harness repository. Maintain its website, CLI, tests, and export code here. Use the Harness root for the commands below; no separate Project Reports repository is required.

A local presentation hub for feature work and full test runs. Reports stay in `~/.codex/project-reports`, outside application repositories. The Bun CLI writes versioned manifests and copied evidence; active reports also accept screenshot and audio uploads in the local browser. Configured Cloudflare R2 is the default storage for new evidence, with local originals retained for exports. Finalized runs keep a portable HTML gallery, PDF, and ZIP.

The hub uses a dark navy and gold gallery with project history, status and project filters, deep links to findings and screenshots, before/after viewing, and live updates while a report runs. Active reports accept a matched before/after image upload. Feature reports focus on changed flows. Suite reports list workflow coverage and desktop 1440px, tablet 920px, and mobile 390px evidence. Every report leads with outcome, checks, gaps, environment, and revision. Missing assets are labeled as unproven.

## Cloudflare screenshot storage

### Default evidence storage

With the R2 settings below configured, CLI/import evidence and browser audio uploads go to the private R2 bucket automatically. The manifest is saved only after the upload succeeds. Audio and CLI screenshots use `report-evidence/runs/<run>/assets/<content-hash>.<extension>`. Generated MP4 replays upload on download and use `report-evidence/runs/<run>/replays/<frame-digest>.mp4`; a storage receipt allows recovery without re-encoding. Gallery playback retrieves original R2 bytes through the local server, including audio seeking.

Harness report commands read explicit environment variables and the configuration references in `~/.codex/harness/report-settings.json`, independent of the caller's directory. `PROJECT_REPORTS_CONFIG_FILE` selects an external, owner-readable configuration file. Real reports reject `PROJECT_REPORTS_ASSET_STORAGE=local` and incomplete R2 configuration. Offline mode is restricted to tests or an explicitly selected temporary `PROJECT_REPORTS_HOME`. Tests use local fixtures and a fake R2 endpoint.

Backfill existing unexpired local evidence and cached MP4s without changing results, transcripts, export bytes, or report dates:

```bash
bun run report sync-storage --dry-run
bun run report sync-storage
bun run report sync-storage --run RUN_ID
```

The command updates only storage metadata, skips expired reports, and can be retried. Any per-report errors are returned with a nonzero exit status.

The site runs locally. Browser uploads place image bytes in a private Cloudflare R2 bucket and keep a local copy for portable exports. Report manifests remain under `PROJECT_REPORTS_HOME`; uploaded evidence is read from R2 by the gallery. Create a bucket dedicated to Project Reports and an R2 Object Read & Write token scoped to that bucket. Put these values in an external, owner-readable file selected by `PROJECT_REPORTS_CONFIG_FILE` or the Harness report settings:

```text
PROJECT_REPORTS_R2_ACCOUNT_ID=<Cloudflare account ID>
PROJECT_REPORTS_R2_BUCKET=<dedicated bucket name>
PROJECT_REPORTS_R2_ACCESS_KEY_ID=<R2 access key ID>
PROJECT_REPORTS_R2_SECRET_ACCESS_KEY=<R2 secret access key>
```

Never commit the token. The form accepts PNG, JPEG, and WebP files up to 50 MB each, only on active reports. Uploaded images start as **Not proven** evidence; attaching a screenshot does not assert that a check passed. The server accepts up to 110 MB for the multipart request. For a built Node server, set `BODY_SIZE_LIMIT=110M` when starting it. The bucket remains private and the site is not deployed by this setup.
The local server inherits Harness report settings; explicit environment variables take precedence.

### Thirty-day report retention

Every report expires 30 days after its immutable `startedAt` timestamp. The daily cleanup deletes the whole expired report, including local originals, audio, MP4 replay caches, HTML/PDF/ZIP exports, associated publication staging, all R2 copies, and explicitly published Pages previews. Later backfills and downloads do not restart this clock. Newer reports and caller source files in application repositories are preserved. Failed cloud deletion preserves local metadata for retry.

Install/update the existing daily cleanup job on this Mac:

```bash
bun run report cleanup --dry-run
python3 packages/reports/scripts/install_screenshot_retention.py
bun run report cleanup
```

The existing LaunchAgent label is reused. It runs at 03:00 local time and on load; catch-up runs after the Mac returns. A bounded 30-day history is written to `PROJECT_REPORTS_HOME/retention-history.jsonl`. `--run RUN_ID` restricts cleanup to one report. Without that flag it also expires old orphan objects and loose cache/import/backup files inside the report store, without following symlinks. Source repositories and files outside the report store are excluded.

Configure enabled R2 lifecycle rules to delete objects after 30 days for each prefix: `uploaded-screenshots/`, `report-evidence/`, and `published-reports/`. Preserve any unrelated existing rules. These rules work even when the Mac is offline; they measure age from upload, while local cleanup deletes all cloud copies at report expiry. [Cloudflare normally removes objects within 24 hours of lifecycle expiry](https://developers.cloudflare.com/r2/buckets/object-lifecycles/). Lifecycle configuration needs bucket-management permission; the object-only token used for uploads is insufficient. Pages copies expire through the scheduled cleanup using this repository's isolated Pages credentials.

## Start and view

From the Harness repository root:

```bash
bun install
bun run report serve
```

`serve` reuses a matching loopback server, prefers port 5588, skips occupied ports, and leaves the server running. Open the returned URL in the Codex in-app browser. `bun run dev:reports` is also available for ordinary frontend work.

## CLI

Run these from the Harness repository root, use installed `harness report`, or invoke `bun /Users/danielfugere/projects/harness/src/index.ts report` from another project:

```bash
bun run report begin --project /path/to/project --title 'Task name' --mode feature --environment 'local browser' --revision COMMIT
bun run report record --run RUN_ID --kind check --data '{"id":"unit","title":"Unit tests","status":"passed","command":"bun test"}'
bun run report record --run RUN_ID --kind evidence --data '{"id":"after-mobile","title":"Mobile result","category":"Changed flow","path":"/absolute/screenshot.png","status":"passed","viewport":"390px mobile","phase":"after","comparison":"main-flow","order":2}'
bun run report finalize --run RUN_ID
bun run report cleanup
```

`begin` supports `feature` and `suite` modes, optional `--summary`, `--historical`, and `--acceptance` JSON array. `record` accepts `check`, `evidence`, `finding`, `coverage`, `acceptance`, `summary`, and `heartbeat`, with `--data` JSON or `--file` JSON. Record acceptance criteria during a run with `--kind acceptance --data '{"items":["The changed flow works"]}'`; this replaces the active list. Use `before` and `after` phases with the same `comparison` value to pair screenshots. Include `source` and `capturedAt` when available. Statuses are `running`, `passed`, `failed`, `blocked`, `skipped`, `not-proven`, and `interrupted`.

Import existing runner output without changing the project's test commands:

```bash
bun run report import --run RUN_ID --format playwright --file /path/to/playwright-results.json
bun run report import --run RUN_ID --format vitest --file /path/to/vitest-results.json
bun run report import --run RUN_ID --format command --file /path/to/command-outcome.json
bun run report import --run RUN_ID --format manual --file /path/to/records.json
```

A command outcome is JSON with `title`, `exitCode`, `command`, `output`, and optional `durationMs`. A manual import is a JSON array of `record` objects. The `mira` format imports the existing Fatebound archive with `--file`, `--findings`, and `--project`, creating a historical suite report if `--run` is omitted.

The version 1 manifest records project path and ID, run ID, mode, environment, revision, summary, checks, findings, coverage, acceptance criteria, and ordered evidence. Each screenshot stores its category, source, captured time, viewport, phase, comparison group, and status. Keep raw credentials and private request data out of input files; recognized secret strings and URL query values are redacted before storage. Only manifest-registered images, audio and exports are served. The ZIP includes only registered assets.

## Audio evidence

Use the same report gallery for screenshots and recordings. On an active report, expand **Add audio** and choose **Single recording** or **Before and after**. Upload WAV, MP3, M4A or Ogg files (up to 50 MB each), with a title, source and notes. A comparison validates both files before adding either. Audio uses configured private R2 storage by default, with a local copy, and starts as **Not proven**. Uploading or playing a clip does not turn a failed test into a passing one. The same project-specific R2 settings apply to screenshots and audio.

The gallery offers All media, Screenshots and Audio filters, category and status filters, and search across titles, notes, sources and transcripts. Each audio card has native playback, seeking, original-file download and expandable provenance. Starting another clip pauses the previous clip. Files load when played; visiting a report does not download every recording. Browser codec support varies; use WAV or MP3 for broad compatibility.

To attach a recording through the CLI:

```bash
bun run report record --run RUN_ID --kind evidence --data '{"id":"fresh-yes","title":"French fresh yes","category":"Fresh commands","path":"/absolute/yes.wav","status":"failed","source":"Actual GPT Live capture","capturedAt":"2026-09-26T12:00:00Z","transcript":"Mm-hm.","note":"Classifier rejected this fresh query."}'
```

The CLI validates the file contents, derives media type and MIME type, hashes the original bytes and derives PCM WAV duration. For other formats, duration appears after playback loads metadata; an optional `durationSeconds` can be supplied with known provenance. Historical recordings should retain their capture dates and original outcomes and use a new `--historical` report. Finalized histories remain immutable.

To compare recordings through the CLI, record one with `"phase":"before"` and one with `"phase":"after"`, sharing a nonempty `"comparison"` ID and the same viewport. Exactly one recording on each side creates a labeled comparison. Both players keep their own sources, dates, transcripts, statuses and downloads; starting one pauses the other. Search and status filters can match either side. Original audio clip counts include both sides; the gallery counts the pair as one entry. Unpaired or ambiguous recordings remain separate. Use genuinely corresponding runs for application Before/After claims.

Portable HTML embeds playable original audio and works offline. The ZIP includes each registered original asset once, and the PDF lists audio metadata and outcomes; a PDF cannot play audio. Large recording collections produce large portable HTML and ZIP files. Audio receives single-range HTTP responses for seeking and is never routed through the screenshot zoom viewer. Missing assets are labeled Not proven.

## Publish a selected report for phone playback

Completed reports are published to Cloudflare by default using the existing Project Reports
UI and the command below, unless Daniel requests a local-only or draft-only handoff.
Automatic private asset uploads do not publish the website: finalize, publish, and verify
the hosted report before handing off its Cloudflare URL. Generated audio evidence must
include its matching transcript, visible by default beneath its player. Do not substitute
a separate HTML listening page or report microsite. Report publication does not authorize
deployment of the application being tested or posting to GitHub or messaging services.
The following one-time setup uses a project-local Wrangler login and the same
Cloudflare account as the R2 settings:

```bash
XDG_CONFIG_HOME="$PWD/.env.cloudflare-auth" bunx wrangler login --scopes account:read user:read pages:write
XDG_CONFIG_HOME="$PWD/.env.cloudflare-auth" CLOUDFLARE_ACCOUNT_ID=<report-account-id> bunx wrangler pages project create project-report-shares --production-branch=main
bun run report publish --run RUN_ID
```

The login directory is ignored; restrict it to the owner. Use
`PROJECT_REPORTS_PAGES_PROJECT` for a dedicated project with another name.
The command publishes only this finalized report's registered originals and
portable HTML/PDF/ZIP, preserving its failed or passing outcomes. It uploads a
content-addressed copy to private R2 under `published-reports/`, then creates an
isolated Pages deployment on `report-RUN_ID` and verifies every hosted file's
SHA-256 and MIME type. The returned HTTPS link plays embedded original audio and
works without the Mac's local server. The selected report is publicly readable
at this link; choose reports suitable for sharing. Other report histories and the
R2 bucket remain private.

A separate receipt under `PROJECT_REPORTS_HOME/publications/RUN_ID.json` records
the URL, artifact digest, test revision and file hashes. The finalized manifest
is unchanged. Retry the same command after a publication failure. File size is
limited to [25 MiB per Pages asset](https://developers.cloudflare.com/pages/platform/limits/).

## Verification

```bash
bun run check
bun run test:e2e
```

`check` runs format, type, lint, unit, build, and Harness audit. Browser tests cover filters, comparisons, keyboard controls, modal details, and 1440px/920px/390px layouts. The project is Harness-governed; read `AGENTS.md` and the project-local Harness skill before code changes.
