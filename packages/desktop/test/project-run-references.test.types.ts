import type { fixture } from './run-fixture';

/**
 * A creation run asks with the registered ids of every catalog, those the request names first,
 * and says in public only what was checked: the notes of a valid proposal, or an answer in plain
 * words such as a question. Raw JSON is never said, and the strict proposal rules are unchanged.
 */
export type Fixture = Awaited<ReturnType<typeof fixture>>;
