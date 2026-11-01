# CLI startup and state guidance prevention

The Sol-12 unitShots implementation at 8d405f736e imported Desktop runtime readers
and recordedScope, whose $reports import depends on generated SvelteKit config.
The CLI therefore failed to load in a fresh checkout, including unrelated units
commands. Main alone started successfully in merge-routine qualification.

The earliest missed control was root-test setup: test/svelteKitConfigs.ts syncs
apps before collection, and CLI subprocess tests used that prepared source tree.
The existing config-readiness case now also starts the CLI from a clean source
copy without generated app configs. This runs in normal root unit verification,
covers future CLI import changes, and needs no browser or remote machine.

The existing units-guide matrix also distinguishes component catalog declarations
from broader workspace scenario coverage. Named unit states block DONE; optional
prop boundaries, contract enums and source-derived guesses stay advisory until
the unit's catalog or dedicated scenario declares them. A complete named-state
fixture must reach DONE even when those guesses have no captures.

Regression command:
`bun x vitest run test/svelte-kit-configs.test.ts test/units-guide.test.ts test/units-check-contract.test.ts`.
Record a committed failing checkpoint, preserve this exact matrix, then repair
root evidence access and state derivation. Qualify an isolated fresh checkout
before any SvelteKit sync with index, guide and typecheck, then run root Vitest.
