import type { JevEvaluator } from '../../src/audit/development-tooling/cleanCodeEvaluate.types';
import type { evaluateCleanCodeFile } from '../../src/audit/development-tooling/cleanCodeEvaluate';

export type Evaluation = Awaited<ReturnType<JevEvaluator>>;

export type Answer = Evaluation['answers'][string];

export type Review = Awaited<ReturnType<typeof evaluateCleanCodeFile>>;
