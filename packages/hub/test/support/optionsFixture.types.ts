import type { fixture as planningFixture } from '../../../planning/test/planFixture';

/**
 * SYNTHETIC design options as the real planning package commits them: plans are written in a
 * temporary Git repository by planning itself, and the hub then reads exactly the files committed
 * there. No image was generated; every picture is a small synthetic PNG of its own.
 */
export type Json = Record<string, unknown>;

export type Planning = Awaited<ReturnType<typeof planningFixture>>['api'];

export type Stored = { versions: Json[]; path: string; contractHash: string };
