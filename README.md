# Frame

Frame is an opinionated CLI for humans and coding agents. It gives projects a Rails-like
structure for TypeScript: small files, focused classes, small functions, generators, specs,
and static guidance that agents can query before making a change.

## Commands

```bash
bun run dev -- new lib my-lib
bun run dev -- new app my-app
bun run dev -- generate model Post title:string body:text --adapter sqlite
bun run dev -- info model
bun run dev -- info model --json
bun run dev -- audit .
```

## Project Families

- `app` scaffolds a SvelteKit-shaped application inspired by Daniel's `app-template`.
- `lib` scaffolds a Bun TypeScript package.

## Frame Rules

- One file should have one reason to change.
- Prefer small functions and tiny classes over broad modules.
- Generate a feature spec before implementation work.
- Keep persistence behind adapters.
- Give agents static, explicit instructions through `frame info`.
