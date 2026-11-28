// @harness-uid u_ukg7o7reue
import { z } from 'zod';
import { sanitizeText } from '$reports/lib/projects-sessions/project-overview/projectOverviewPrivacy';
import { parseHomePayload } from './homePayload';

const text = (max: number) =>
	z
		.string()
		.max(max)
		.transform((value) => sanitizeText(value));
const short = text(200);
const time = z.string().datetime();
const count = z.number().int().min(0).max(1_000_000);

const row = z.object({
	key: text(300),
	itemId: z.string().min(1).max(200),
	runId: z.number().int().positive().optional(),
	title: text(500),
	state: z
		.enum(['running', 'offline', 'queued', 'blocked', 'no-run', 'finished'])
		.transform((state) => (state === 'no-run' ? ('blocked' as const) : state)),
	outcome: short.nullable(),
	status: z.enum(['open', 'in_progress', 'blocked', 'done']),
	stage: z.enum(['idea', 'detail', 'design', 'build']).nullable(),
	// Older Mac apps send no milestone; they show none rather than failing the overview.
	now: text(300)
		.nullish()
		.transform((value) => value ?? null),
	owner: short.nullable(),
	computer: short.nullable(),
	model: short.nullable(),
	startedAt: time.nullable(),
	updatedAt: time
});

const project = z.object({
	agent: short,
	running: count,
	totalRows: count.optional(),
	blockedRows: count.optional(),
	waitingRows: count.optional(),
	counts: z.object({ open: count, in_progress: count, blocked: count, done: count }),
	rows: z.array(row).max(100),
	updatedAt: time
});

const liveOverview = z.object({
	readAt: time,
	projects: z.array(project).max(200),
	machines: z
		.array(
			z.object({
				name: short,
				status: z.enum(['ok', 'busy', 'overloaded', 'offline']),
				remoteRuns: count.optional(),
				agentCount: count.optional(),
				reasons: z.array(short).max(12).optional(),
				resources: z
					.object({
						ramAvailableMB: z.number().nonnegative().optional(),
						ramTotalMB: z.number().positive().optional(),
						cores: z.number().int().positive().optional(),
						loadOne: z.number().nonnegative().optional(),
						diskFreeGB: z.number().nonnegative().optional()
					})
					.optional(),
				sessions: z
					.array(z.object({ key: text(300), title: text(500), origin: short.nullable() }))
					.max(100)
					.optional()
			})
		)
		.max(200),
	hiddenRuns: count,
	omittedRows: count
});

/**
 * What a linked computer answered over the encrypted connection. Only this path reads the live
 * overview: the stored Home is parsed without it, so a copy on the Hub can never hold one. An
 * overview this Hub cannot read is dropped and the rest of Home stays.
 */
export function parseLinkedHome(value: unknown) {
	const snapshot = parseHomePayload(value);
	const live = z.object({ liveOverview }).safeParse(value);
	return live.success ? { ...snapshot, liveOverview: live.data.liveOverview } : snapshot;
}
