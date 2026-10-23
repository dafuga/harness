import type { optionsFixture } from '../support/optionsFixture';

/**
 * The rectangle a version revises is read under the rule planning writes it by: inside the
 * image, never empty. A rectangle reaching the right and bottom edges is kept exactly; an empty
 * or overflowing one is refused. SYNTHETIC planning-written Git files as checked out, with only
 * the stored region of v002 changed before the hub reads them.
 */
export type Fixture = Awaited<ReturnType<typeof optionsFixture>>;

export type Region = { x: number; y: number; width: number; height: number };

export type Option = { images: Array<{ sha256: string }> };
