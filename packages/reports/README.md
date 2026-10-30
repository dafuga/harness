# Project Reports in Harness

This app is the `packages/reports` workspace in the Harness repository. Maintain its website, CLI and tests here. Use the Harness root for the commands below; no separate Project Reports repository is required.

The explorer website presents registered units, contracts, history and verification evidence. The retained media CLI writes versioned manifests and copied evidence under `~/.codex/project-reports`, outside application repositories. Configured Cloudflare R2 stores evidence, with local originals retained. Finalization seals the manifest; it does not generate downloadable reports.

The explorer uses shared screenshot and audio viewers for entity evidence. The old report gallery, report detail screen, browser upload controls and HTML/PDF/ZIP export pipeline have been removed.

## Cloudflare screenshot storage

### Default evidence storage

With the R2 settings below configured, CLI/import evidence go to the private R2 bucket automatically. The manifest is saved only after the upload succeeds. Audio and CLI screenshots use `report-evidence/runs/<run>/assets/<content-hash>.<extension>`. Generated MP4 replays upload on download and use `report-evidence/runs/<run>/replays/<frame-digest>.mp4`; a storage receipt allows recovery without re-encoding. Gallery playback retrieves original R2 bytes through the local server, including audio seeking.

Harness report commands read explicit environment variables and the configuration references in `~/.codex/harness/report-settings.json`, independent of the caller's directory. `PROJECT_REPORTS_CONFIG_FILE` selects an external, owner-readable configuration file. Real reports reject `PROJECT_REPORTS_ASSET_STORAGE=local` and incomplete R2 configuration. Offline mode is restricted to tests or an explicitly selected temporary `PROJECT_REPORTS_HOME`. Tests use local fixtures and a fake R2 endpoint.

Backfill existing unexpired local evidence and cached MP4s without changing results, transcripts, or report dates:

```bash
bun run report sync-storage --dry-run
bun run report sync-storage
bun run report sync-storage --run RUN_ID
```

The command updates only storage metadata, skips expired reports, and can be retried. Any per-report errors are returned with a nonzero exit status.

The site runs locally. Evidence ingestion places image bytes in a private Cloudflare R2 bucket and keep a local copy. Report manifests remain under `PROJECT_REPORTS_HOME`; uploaded evidence is read from R2 by the gallery. Create a bucket dedicated to Project Reports and an R2 Object Read & Write token scoped to that bucket. Put these values in an external, owner-readable file selected by `PROJECT_REPORTS_CONFIG_FILE` or the Harness report settings:

```text
PROJECT_REPORTS_R2_ACCOUNT_ID=<Cloudflare account ID>
PROJECT_REPORTS_R2_BUCKET=<dedicated bucket name>
PROJECT_REPORTS_R2_ACCESS_KEY_ID=<R2 access key ID>
PROJECT_REPORTS_R2_SECRET_ACCESS_KEY=<R2 secret access key>
```

Never commit the token. The evidence API accepts PNG, JPEG, and WebP files up to 50 MB each, only on active reports. Uploaded images start as **Not proven** evidence; attaching a screenshot does not assert that a check passed. The server accepts up to 110 MB for the multipart request. For a built Node server, set `BODY_SIZE_LIMIT=110M` when starting it. The bucket remains private and the site is not deployed by this setup.
The local server inherits Harness report settings; explicit environment variables take precedence.

### Thirty-day report retention

Every report expires 30 days after its immutable `startedAt` timestamp. The daily cleanup deletes the whole expired report, including local originals, audio, MP4 replay caches, any exports and publication staging left by earlier versions, all R2 copies, and Pages previews published by earlier versions. Later backfills and downloads do not restart this clock. Newer reports and caller source files in application repositories are preserved. Failed cloud deletion preserves local metadata for retry.

Install/update the existing daily cleanup job on this Mac:

```bash
bun run report cleanup --dry-run
python3 packages/reports/scripts/install_screenshot_retention.py
bun run report cleanup
```

The existing LaunchAgent label is reused. It runs at 03:00 local time and on load; catch-up runs after the Mac returns. A bounded 30-day history is written to `PROJECT_REPORTS_HOME/retention-history.jsonl`. `--run RUN_ID` restricts cleanup to one report. Without that flag it also expires old orphan objects and loose cache/import/backup files inside the report store, without following symlinks. Source repositories and files outside the report store are excluded.

Configure enabled R2 lifecycle rules to delete objects after 30 days for each prefix: `uploaded-screenshots/`, `report-evidence/`, and, while earlier publications remain, `published-reports/`. Preserve any unrelated existing rules. These rules work even when the Mac is offline; they measure age from upload, while local cleanup deletes all cloud copies at report expiry. [Cloudflare normally removes objects within 24 hours of lifecycle expiry](https://developers.cloudflare.com/r2/buckets/object-lifecycles/). Lifecycle configuration needs bucket-management permission; the object-only token used for uploads is insufficient. Pages copies published by earlier versions expire through the scheduled cleanup using this repository's isolated Pages credentials.

## Start and view

From the Harness repository root:

```bash
bun install
bun run report serve
```

`serve` reuses a matching loopback server, prefers port 5588, skips occupied ports, and leaves the server running. Open the returned URL in the Codex in-app browser. `bun run dev:reports` is also available for ordinary frontend work.

## Managed development preview recovery

`bun run dev:reports` and the desktop development command share one loopback owner.
The launch command stays running as a supervisor, with one replaceable Node/Vite worker.
It recovers a crashed or unresponsive worker and repeated HTTP 500 failures at the same
address. Three failed health checks trigger recovery; the old worker exits before its
replacement starts. Repeated failures back off up to 30 seconds. Initial configuration
errors still fail visibly instead of silently choosing another port.

Cached history and media are left intact. Server-error restarts wait while a project agent
is active; normal shutdown cancels that worker's project requests. Intentional shutdown
stops monitoring and does not respawn. This supervises the worker, so the original launch
command must remain running. It does not regenerate Git history caches or repair source
compilation errors.

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

The version 1 manifest records project path and ID, run ID, mode, environment, revision, summary, checks, findings, coverage, acceptance criteria, and ordered evidence. Each screenshot stores its category, source, captured time, viewport, phase, comparison group, and status. Keep raw credentials and private request data out of input files; recognized secret strings and URL query values are redacted before storage. Only manifest-registered images and audio are served.

## Audio evidence

The explorer renders recorded audio alongside entity evidence, including transcripts and before/after comparisons. Record new audio through the CLI.

To attach a recording through the CLI:

```bash
bun run report record --run RUN_ID --kind evidence --data '{"id":"fresh-yes","title":"French fresh yes","category":"Fresh commands","path":"/absolute/yes.wav","status":"failed","source":"Actual GPT Live capture","capturedAt":"2026-09-26T12:00:00Z","transcript":"Mm-hm.","note":"Classifier rejected this fresh query."}'
```

The CLI validates the file contents, derives media type and MIME type, hashes the original bytes and derives PCM WAV duration. For other formats, duration appears after playback loads metadata; an optional `durationSeconds` can be supplied with known provenance. Historical recordings should retain their capture dates and original outcomes and use a new `--historical` report. Finalized histories remain immutable.

To compare recordings through the CLI, record one with `"phase":"before"` and one with `"phase":"after"`, sharing a nonempty `"comparison"` ID and the same viewport. Exactly one recording on each side creates a labeled comparison. Both players keep their own sources, dates, transcripts, statuses and downloads; starting one pauses the other. Search and status filters can match either side. Original audio clip counts include both sides; the gallery counts the pair as one entry. Unpaired or ambiguous recordings remain separate. Use genuinely corresponding runs for application Before/After claims.

Audio receives single-range HTTP responses for seeking and is never routed through the screenshot zoom viewer. Missing assets are labeled Not proven.

## Verification

```bash
bun run check
bun run test:e2e
```

`check` runs format, type, lint, unit, build, and Harness audit. Browser tests cover filters, comparisons, keyboard controls, modal details, and 1440px/920px/390px layouts. The project is Harness-governed; read `AGENTS.md` and the project-local Harness skill before code changes.

## Functions catalog

Functions lists exported, standalone helpers in shared utility modules (`src/utils`, `src/helpers`, `src/functions`, `src/core`, and `src/lib/{utils,helpers,functions}` within each workspace). A helper is shared only when at least two distinct active components, services or named functions use that exact helper. Any mixture counts. Repeated calls from one consumer, unused imports, type references, self-recursion and barrel exports do not add consumers. Caller facts come from the selected commit, including import aliases and forwarding exports. Component-local functions, class methods, types, constants, schemas, validators and service internals are excluded.

Each helper gets an alphabetically sorted example-call card. Modules exporting several helpers get several cards, all linking to the owning entity's contract and history. Signatures come from the selected Git revision, while argument examples come from its committed contract or usage document. Missing examples remain named parameters. No working-tree fallback fills historical gaps. Older projections without helper metadata must be refreshed before their helpers can be listed.

When changing catalog identities or card labels, preserve search by both the displayed symbol and the owning entity name. The collection identity matrix enforces both in the normal unit suite; run the existing 1,000-row responsive console scenario for catalog changes. This catches label changes that unintentionally remove previously searchable names.

When deriving catalog labels from exports, use the shared multi-export fixture: unrelated options and result types surround the implementation symbol. Assert the displayed implementation name and its owning entity link in both the standard card unit coverage and responsive browser matrix. Export order alone does not identify a class or service.
