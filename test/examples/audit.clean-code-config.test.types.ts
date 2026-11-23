import type { resolveCleanCodeSettings } from '../../src/audit/development-tooling/cleanCodeConfig';
import type { recordExampleCases } from '../support/recordExampleCases';

export type ResolveOptions = Parameters<typeof resolveCleanCodeSettings>[1];

export type Cases = Parameters<typeof recordExampleCases>[1];
