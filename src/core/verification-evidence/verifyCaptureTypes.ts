// @harness-uid u_wwu3xgisul
import {
	videoCaptureSchema,
	videoReferenceSchema
} from '../../utils/verification-evidence/videoClipSchema';
import { z } from 'zod';
import { unitIdPattern } from '../development-tooling/unitTypes';
import { captureRegionSchema } from './verificationTypes';

const text = z.string().min(1);
const identifier = z.string().regex(unitIdPattern);

/** One line a check writes to `captures.ndjson` in `HARNESS_EVIDENCE_DIR`. */
export const captureLineSchema = z.strictObject({
	video: videoCaptureSchema.optional(),
	videoReference: videoReferenceSchema.optional(),
	evidence: identifier,
	kind: z.enum(['screenshot', 'video', 'audio', 'output', 'assertions', 'trace', 'benchmark']),
	state: identifier,
	viewport: identifier.optional(),
	clip: captureRegionSchema.optional(),
	/** File name inside the evidence directory. */
	file: z.string().regex(/^[\w.-]+$/, 'must be a plain file name'),
	mediaType: text,
	provenance: z.enum(['fixture', 'actual-capture']).optional(),
	transcript: z.string().optional(),
	durationSeconds: z.number().positive().optional(),
	server: z.strictObject({ buildId: text, revision: text }).optional(),
	note: z.string().optional()
});
