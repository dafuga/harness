import type { JevRequest } from '../../core/agents-providers/jevTypes';
import type { JevEvaluation } from '../../core/agents-providers/jevTypes';

export type Evaluate = (request: JevRequest) => Promise<JevEvaluation>;
