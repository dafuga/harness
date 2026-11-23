import type { JevEvaluation } from '../../src/core/agents-providers/jevTypes';
import type { FileReview } from '../../src/audit/development-tooling/cleanCodeTypes';
import type { recordExampleCases } from '../support/recordExampleCases';

export type Answer = JevEvaluation['answers'][string];

export type Choice = Answer['choice'];

export type ReviewStatus = FileReview['status'];

export type Cases = Parameters<typeof recordExampleCases>[1];
