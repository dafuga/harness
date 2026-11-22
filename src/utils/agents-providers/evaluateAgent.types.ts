// @harness-uid u_2e5xbm5hg2
import type { z } from 'zod';

export interface AgentEvaluation<Schema extends z.ZodType> {
	model: string;
	prompt: string;
	schema: Schema;
}

export type AgentEvaluator = <Schema extends z.ZodType>(
	input: AgentEvaluation<Schema>
) => Promise<z.output<Schema>>;
