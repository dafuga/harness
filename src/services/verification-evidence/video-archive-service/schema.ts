// @harness-uid u_qfigvyo5j5
import { z } from 'zod';
import { videoCaptureSchema } from '../../../utils/verification-evidence/videoClipSchema';

export const mediaLimit = 8 * 1024 * 1024;
export const batchLimit = 512 * 1024 * 1024;
export const hashSchema = z.string().regex(/^[a-f0-9]{64}$/);
const commit = z.string().regex(/^[a-f0-9]{40}$/);
const id = z.string().regex(/^[a-z0-9]+(?:[.-][a-z0-9]+)*$/);
const media = z.strictObject({
	path: z.string().regex(/^media\/[a-f0-9]{64}\.(?:mp4|png)$/),
	sha256: hashSchema,
	bytes: z.number().int().positive().max(mediaLimit)
});
export const slotSchema = z.strictObject({
	unit: id,
	unitUid: z.string().regex(/^u_[a-z2-7]{10}$/),
	clipId: id,
	state: id,
	viewport: id,
	profile: z.literal('normal')
});
export const clipSchema = z.strictObject({
	slot: slotSchema,
	original: z.strictObject({
		revision: commit,
		tree: commit,
		buildId: hashSchema,
		capturedAt: z.string().datetime()
	}),
	video: videoCaptureSchema,
	durationSeconds: z.number().positive().max(15),
	media,
	poster: media
});
export const batchSchema = z.strictObject({
	schemaVersion: z.literal(1),
	kind: z.literal('harness-video-batch'),
	clips: z.array(clipSchema).min(1).max(64)
});
export const pointerSchema = z.strictObject({
	schemaVersion: z.literal(1),
	kind: z.literal('harness-video-batch'),
	batch: hashSchema,
	evidence: z.strictObject({
		commit,
		path: z.string().regex(/^video-batches\/[a-f0-9]{64}$/),
		manifest: hashSchema
	})
});
export const manifestSchema = z.strictObject({
	schemaVersion: z.literal(1),
	kind: z.literal('harness-video-batch-manifest'),
	batch: hashSchema,
	files: z
		.array(
			z.strictObject({
				path: z.string().regex(/^(?:batch\.json|media\/[a-f0-9]{64}\.(?:mp4|png))$/),
				sha256: hashSchema,
				bytes: z.number().int().positive().max(batchLimit),
				lfs: z.boolean()
			})
		)
		.min(3)
		.max(129)
});
