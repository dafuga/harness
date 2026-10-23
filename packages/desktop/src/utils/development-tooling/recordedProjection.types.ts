import type { HarnessRevision } from '../../../../reports/src/models/Harness.types';

export type Impact = NonNullable<HarnessRevision['sourceImpact']>;

/** The scenarios that cover the entity on one side, each with the states that show it. */
export type Shown = Map<string, Set<string>>;

export type Staged = { id: string; states: Array<{ id: string }> };
