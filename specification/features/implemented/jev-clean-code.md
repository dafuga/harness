# Feature: Jev Clean Code

## Overview

Add an opt-in Jev review to Harness audit. Review source files sequentially with bounded
local context and a language-aware rubric inspired by Robert C. Martin's Clean Code.
Jev supplies closed-set judgments; Harness supplies guidance and source-grounded locations.

## Acceptance Criteria

- Normal audits remain offline unless cleanCode.mode or --clean-code enables review.
- --gate blocks confident violations; uncertain judgments remain non-blocking review items.
- --json exposes per-file assessments, content hashes, context, coverage, model and rubric
  versions, confidence, probabilities, and usage. --dry-run needs no API key or calls.
- Review JS/TS, Svelte, Python, C/C++, SQL, and shell source, including tests, independently
  of the deterministic audit profile. Report unsupported and excluded paths explicitly.
- Respect Git ignores, exclusions, generated artifacts, symlinks, and project boundaries.
- Include bounded direct imports, matching tests, conventions, and deterministic findings.
  Unreadable or oversized targets are incomplete, never silently truncated or called clean.
- Use the official TypeSafe SDK with an explicit project-owned environment credential and
  pinned model, bounded retries/timeouts, cancellation, response validation, and safe errors.
- Cache validated judgments by the complete review inputs. --refresh bypasses the cache;
  source/context changes during a review invalidate its result.
- Keep meaningful uncertainty visible. Never describe uncertain or incomplete reviews as clean.
- Add clean-code guidance and disabled configuration to generated projects.
- Demonstrate unchanged red/green CLI regressions, focused unit/API tests, and bun run check.
- Live accuracy evaluation is separate from mocked integration proof and needs a dedicated key.

## Future Enhancements

- Additional languages, whole-codebase architecture analysis, and optional generated explanations.
