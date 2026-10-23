import type { fixture } from './run-fixture';

/**
 * A Plan of a page makes its design options one by one, each from its own direction, and commits
 * them together as one immutable version: three unless the Plan asks for another count. A failed
 * or cancelled option leaves no version and no commit of one. A headless Plan stays notes only.
 */
export type Made = Awaited<ReturnType<typeof fixture>>;
