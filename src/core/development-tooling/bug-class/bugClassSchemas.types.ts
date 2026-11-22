// @harness-uid u_wwerrde2nk
import type { z } from 'zod';
import type {
	bugClassSchema,
	candidateVerdictSchema,
	searchPatternSchema
} from './bugClassSchemas';

export type BugClass = z.infer<typeof bugClassSchema>;
export type SearchPattern = z.infer<typeof searchPatternSchema>;
export type CandidateVerdict = z.infer<typeof candidateVerdictSchema>;
