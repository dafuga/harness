import type { fixture } from './planFixture';

/**
 * Design options: a Plan of a visual unit keeps several distinct designs in one immutable version,
 * each an identity of its own apart from the version, state and viewport. An approval and a thread
 * bind one exact option. A version written before options reads and approves as it always did.
 */
export type Api = Awaited<ReturnType<typeof fixture>>['api'];

export type Image = { file: string; sha256: string };

export type Option = { id: string; direction: unknown; images: Image[] };
