import type { optionsFixture } from '../support/optionsFixture';

/**
 * The hosted reader shows a version of design options as planning committed it: each option with
 * its direction, exact prompts, generator and own images, the image it revises, and an approval
 * of one option as that option's alone. Options that do not divide the images exactly are refused.
 * A single design reads as it always did. SYNTHETIC data written by the real planning package.
 */
export type Fixture = Awaited<ReturnType<typeof optionsFixture>>;

export type Option = { id: string; images: Array<{ file: string; sha256: string }> };
