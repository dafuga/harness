# Harness

Harness is an opinionated CLI for humans and coding agents. It gives projects a Rails-like
structure for TypeScript: small files, focused classes, small functions, generators, specs,
and loop driven development that agents can query before making a change.

## Commands

```bash
bun run dev -- new lib my-lib
bun run dev -- new app my-app
bun run dev -- generate model Post title:string body:text --adapter sqlite
bun run dev -- generate mailer Welcome
bun run dev -- generate resource Article
bun run dev -- info scaffolds
bun run dev -- info model
bun run dev -- info model --json
bun run dev -- loop search feature
bun run dev -- loop create checkout-flow --from feature --goal "Customers can check out"
bun run dev -- loop next checkout-flow
bun run dev -- loop evaluate checkout-flow
bun run dev -- audit .
bun run dev -- audit . --coverage
bun run dev -- audit . --profile app
bun run dev -- audit . --profile dapp
bun run check
```

## Project Families

- `app` scaffolds a SvelteKit-shaped application inspired by Daniel's `app-template`.
- `dapp` audits SvelteKit dApps with Antelope or Harbor smart-contract folders.
- `lib` scaffolds a Bun TypeScript package.

## Harness Rules

- One file should have one reason to change.
- Prefer small functions and tiny classes over broad modules.
- Generate a feature spec before implementation work.
- Keep persistence behind adapters.
- Give agents static, explicit instructions through `harness info`.
- Use inherited `harness loop` templates to drive, evaluate, and trace non-trivial work.
- Use `harness info scaffolds --json` to inspect what each scaffold should contain.
- Use `harness audit --coverage` to inspect which ecosystem adapters covered the project.
- Generated projects use `bun run check` to run format checks, project checks, tests, build, and Harness audit.
- Configure audit and generated lint thresholds with `harness.audit.json`.

## Jev Clean Code review

Harness can review files against a language-aware rubric inspired by Robert C. Martin's
_Clean Code_. The eleven principles cover names, responsibility, functions, abstraction,
duplication, side effects, errors, comments, boundaries, testability, and asynchronous behavior.
Review is disabled by default; ordinary audits make no API calls.

```bash
# Preview exactly which files would be reviewed, without credentials or API calls.
bun run dev -- audit . --clean-code --dry-run --json
# Supply HARNESS_JEV_API_KEY through your project-owned environment, then review.
bun run dev -- audit . --clean-code --json
# Enforce confident violations after assessing advisory results.
bun run dev -- audit . --clean-code --gate
bun run dev -- info clean-code
```

Use a dedicated project credential. Keys belong in the environment, never in audit
configuration. `cleanCode.apiKeyEnv` can select another project-specific variable. Enabling
review sends selected source and bounded local context to the official TypeSafe API.

Add this optional section to `harness.audit.json` to enable review in normal audits and
existing loop evaluators. Newly generated projects include it with `mode: "off"`.

```json
{
	"cleanCode": {
		"mode": "advisory",
		"model": "jev-1.13.0",
		"minConfidence": 0.85,
		"apiKeyEnv": "HARNESS_JEV_API_KEY",
		"exclude": ["src/legacy/", "**/*.generated.ts"]
	}
}
```

Files are reviewed sequentially, including tests, across JS/TS, Svelte, Python, C/C++, SQL,
and shell regardless of the static audit profile. Git ignored files, artifact directories,
symlinks, sensitive paths, and configured exclusions are omitted. Exclusion patterns accept
exact paths, directory prefixes ending in `/`, and `*`, `**`, and `?`. Coverage reports
selected, excluded, and unsupported paths explicitly.

Each request includes the whole target, up to four direct imports and two matching tests,
local conventions, and static findings. State is limited to 24,000 UTF-8 bytes; oversized
targets are incomplete rather than truncated. Related files over 6,000 bytes are omitted;
conventions are bounded excerpts marked as partial. Reports identify omitted context.

Jev supplies typed choices, confidence, and probabilities. Harness supplies predefined
guidance and, when localization is confident, exact excerpts from 40-line source spans.
Low confidence and insufficient context produce `needs-review`, which does not block the
gate. Confidence is model output, not an established probability of correctness. A clean
result applies only to the selected files and supplied context.

Validated judgments are cached locally under `.cache/harness/clean-code`, keyed by source,
supplied context, rubric, model, and settings. `--refresh` bypasses caching; moving model
aliases bypass it automatically. Input changes during review discard the affected judgments.
JSON includes hashes, model/rubric versions, assessments, coverage, and API token usage.
Cached file usage is historical; report totals count new validated responses in this run.

Exit codes are `0` for non-blocking completion, `1` for static failures or confident semantic
violations in gate mode, and `2` for incomplete requested reviews. `--dry-run` previews
coverage and returns `0` without enforcing findings. Requests have a 10-second timeout,
up to two transient retries, and a 30-second total deadline. Authentication errors are not
retried, and provider response bodies are excluded from error messages.

The normal suite tests integration with synthetic API responses. To run the separate live
naming calibration corpus with a dedicated key, use
`HARNESS_JEV_LIVE_TEST=true bunx vitest run test/clean-code-live.test.ts`.
It records confidence, usage, latency, and expected/actual labels across the supported
languages. This small corpus is an initial probe; live accuracy across the whole rubric
must be established before relying on the gate broadly.

## JEV response checking

Check whether an LLM answer follows a user request, including task fulfillment,
completeness, explicit constraints, and relevance. This assesses supplied text;
it does not independently verify external actions or factual claims.

```bash
harness response-check --request request.txt --response answer.txt --dry-run --json
# Supply a project-owned HARNESS_JEV_API_KEY, then assess the answer.
harness response-check --request request.txt --response answer.txt --json
harness response-check --request request.txt --response answer.txt \
  --context context.txt --criteria criteria.json --gate --json
harness info response-check
```

Request and response are UTF-8 files. Optional context supplies prior conversation
or reference material. Optional criteria are a JSON array, for example:

```json
[{ "id": "two-colors", "description": "Include exactly two colors." }]
```

IDs must be unique and nonempty; descriptions must be nonempty. Custom criteria
supplement the four standard checks. The combined serialized input must fit within
24,000 UTF-8 bytes; oversized inputs are rejected without truncation. An empty
request is invalid; an empty answer deterministically fails task fulfillment.

The command defaults to `jev-1.13.0`, confidence threshold `0.85`, and the
project-owned `HARNESS_JEV_API_KEY`. Override with `--model`, `--min-confidence`,
or `--api-key-env`. Explicit invocation sends input to the official TypeSafe API;
normal audits remain unchanged. Dry runs need no credentials and make no calls.
Judgments are not cached. The existing JEV request deadlines and retry limits apply.

JSON includes each check's verdict, confidence, probabilities and fixed guidance,
aggregate status, rubric/model identity, input hashes and token usage. It omits
raw request, answer and context. JEV supplies typed judgments, not explanations;
fixed guidance is not a model-generated diagnosis. Model confidence is not
calibrated correctness. Caller-defined criterion IDs appear in output, so keep
secrets out of IDs.

Advisory assessments exit `0`, including violations or uncertainty. With `--gate`,
only confident success on **every** check exits `0`; violations and uncertainty
exit `1`. Input, credential, and provider failures exit `2` with `incomplete`.
Dry runs exit `0` after successful validation. Unlike the Clean Code gate,
response-check gates block uncertainty.

Existing loop templates can use this command without changing their schema:

```json
{
	"id": "answer-follows-request",
	"title": "Answer follows the user request",
	"command": "harness response-check --request request.txt --response answer.txt --gate --json",
	"step": "verify"
}
```

Place it in the template's `evaluators` array. Paths resolve relative to the loop's
project root. Keep private prompt files outside version control as appropriate.

Normal tests use synthetic provider responses and prove integration only. Run the
separate live instruction-following corpus with a dedicated Harness key:

```bash
HARNESS_JEV_RESPONSE_LIVE_TEST=true bunx vitest run test/response-check-live.test.ts
```

The corpus records expected/actual verdicts, confidence, model, usage and latency
for compliant answers, omissions, formatting/language constraints, irrelevant
content, custom criteria, prior context, missing references and injection attempts.
Live accuracy remains unverified until this corpus is run; it is an initial probe,
not a broad accuracy guarantee.
