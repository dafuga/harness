import type { pieceFiles } from '../../src/templates/development-tooling/pieces';
import type { recordExampleCases } from '../support/recordExampleCases';

export type Kind = Parameters<typeof pieceFiles>[0];

export type Cases = Parameters<typeof recordExampleCases>[1];
