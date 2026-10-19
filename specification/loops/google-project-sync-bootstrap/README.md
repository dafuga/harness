# Portable account client bootstrap

The account implementation at `23641dc6` made the native account adapter load
Hub application sources. Earlier helper forwarding also pointed upward from the
shared renderer into Hub. That coupling depended on Hub's generated SvelteKit
configuration and failed in an isolated checkout. Warm package builds masked it;
the final clean replay detected it before delivery.

The repair moves the existing API port, bridge and error wording into the shared
renderer. Web consumes that portable code. Existing public exports and catalog
identities are preserved, including cold public and owner entrypoints.

## Process prevention

The earliest inexpensive checkpoint is the existing backend-boundary unit suite.
Its new repository-wide assertion rejects shared renderer imports into the Hub
application, including Svelte alias targets. It runs automatically in the normal
Desktop unit command. This guards the dependency direction for every future
portable client, rather than checking only today's account import.

The public and owner bridge entries also run in separate fresh Bun processes.
That follows the project's forwarding-export rule and catches initialization
cycles hidden by a warm module graph. Full clean-snapshot replay remains the
acceptance check; generated app state is never counted as source input.

The boundary scan takes milliseconds; the two cold processes add only tens of
milliseconds. No extra server, polling service or CI workflow is introduced.
An isolated mutation must restore the original upward import, fail the same
boundary assertion, then pass after the source is restored. Its checkpoint is
recorded alongside unchanged red/green proof in this loop.
