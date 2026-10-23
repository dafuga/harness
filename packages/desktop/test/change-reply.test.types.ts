import type { fixture } from './run-fixture';

/**
 * What the agent of a Change said is kept in the notice of that change, so a thread that is
 * opened again shows it with its references. A run that failed or was cancelled keeps what was
 * said until then, above a notice that says how it ended and that verification is pending.
 */
export type Fixture = Awaited<ReturnType<typeof fixture>>;
