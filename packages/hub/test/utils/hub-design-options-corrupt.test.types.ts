import type { optionsFixture } from '../support/optionsFixture';

/**
 * Stored design options are untrusted when hosted: besides dividing the images exactly, they
 * must keep what planning enforced when it wrote them. Directions differ after trimming and
 * case, no picture is shared by two options, and every option prompt hashes to its record.
 * SYNTHETIC planning-written Git files as checked out, changed here before the hub reads them.
 */
export type Fixture = Awaited<ReturnType<typeof optionsFixture>>;

export type Json = Record<string, unknown>;

export type Binding = { file: string; sha256: string };

export type Option = Json & { images: Binding[]; prompt: Binding | null };
