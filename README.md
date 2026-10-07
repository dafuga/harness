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

## Bug and Regression Loops

- Use `harness loop create <name> --from bug-fix --goal <text>` for bug repairs: reproduce with a failing test before implementation, then repeat repair and the same unchanged test until it passes.
- Use `--from regression-prevention` for regressions requiring durable prevention: identify the root cause, propose the repair and guard, implement both, and include the guard in normal project verification.
- Prove the guard rejects reintroducing the original failure in an isolated fixture or temporary workspace; restore the repair and prove the guard passes.
- Record failing and passing commands, assertions, and results as step evidence. Keep green/guard/verification steps pending while proof fails; the agent retries repairs and checks. Harness does not launch an AI repair runner or automatically complete steps.
- For affected UI paths, exercise the browser flow and capture fresh screenshots, then inspect the images before recording proof. Report blockers without claiming completion.
