import type { LegacyReport } from '../../../utils/reports-media/legacyReport';
import { z } from 'zod';
import type { LegacyRecord } from '../../../core/git-source-history/historyTypes';

const text = z.string().min(1);

const manifestSchema = z.object({
	id: text,
	project: z.object({ id: z.string(), name: z.string(), path: z.string() }),
	title: z.string(),
	mode: z.string(),
	environment: z.string(),
	revision: z.string().optional(),
	startedAt: text,
	updatedAt: text,
	summary: z.string().default(''),
	status: text,
	state: z.string(),
	checks: z.array(z.object({ id: text, title: z.string(), status: text })).default([]),
	evidence: z
		.array(
			z.object({
				id: text,
				title: z.string(),
				file: text,
				status: text,
				mediaType: z.string().optional(),
				mimeType: z.string().optional(),
				capturedAt: z.string().optional(),
				viewport: z.string().optional()
			})
		)
		.default([])
});

/**
 * Normalises one manifest of the old report store. Dates, outcome and revision are kept exactly
 * as recorded: a run that was still running stays `running`, and a missing revision stays null.
 */
export function legacyReport(manifest: unknown): LegacyReport | undefined {
	const parsed = manifestSchema.safeParse(manifest);
	if (!parsed.success) return undefined;
	const run = parsed.data;
	const record: LegacyRecord = {
		schemaVersion: 1,
		kind: 'legacy-report',
		id: run.id,
		project: run.project.name || run.project.id,
		title: run.title,
		mode: run.mode,
		environment: run.environment,
		status: run.status,
		state: run.state,
		startedAt: run.startedAt,
		updatedAt: run.updatedAt,
		revision: run.revision?.trim() ? run.revision.trim() : null,
		summary: run.summary,
		checks: run.checks.map(({ id, title, status }) => ({ id, title, status })),
		media: run.evidence.map((item) => ({
			id: item.id,
			title: item.title,
			file: item.file,
			status: item.status,
			...(item.mimeType || item.mediaType ? { mediaType: item.mimeType ?? item.mediaType } : {}),
			...(item.capturedAt ? { capturedAt: item.capturedAt } : {}),
			...(item.viewport ? { viewport: item.viewport } : {}),
			provenance: 'legacy-report' as const,
			sha256: null,
			bytes: null
		}))
	};
	return { project: run.project, record };
}
