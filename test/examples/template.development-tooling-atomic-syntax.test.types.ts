import type { recordExampleCases } from '../support/recordExampleCases';
import type { walkAtomicMarkup } from '../../src/templates/development-tooling/atomicSyntax';

export type Cases = Parameters<typeof recordExampleCases>[1];

export type WalkNode = Parameters<typeof walkAtomicMarkup>[0];
