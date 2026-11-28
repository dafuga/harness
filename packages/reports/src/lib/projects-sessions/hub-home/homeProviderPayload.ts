// @harness-uid u_6dm7i22pxp
import { z } from 'zod';
import { sanitizeText } from '../project-overview/projectOverviewPrivacy';

const text = (max: number) =>
	z
		.string()
		.max(max)
		.transform((value) => sanitizeText(value));
const id = z.string().min(1).max(200);
const time = z.string().datetime();
const short = text(200);
const percent = z.number().min(0).max(100);
const title = text(500);

export const homeRunPayload = z.object({
	id,
	title,
	at: time,
	agent: short.nullable(),
	machine: short.nullable(),
	source: z.enum(['tracker', 'claude']),
	recurring: z.boolean(),
	paused: z.boolean(),
	whenDue: z
		.object({
			state: z.enum(['running', 'queued', 'blocked', 'due']),
			reason: short.nullable(),
			urgency: z.number().int().min(0).max(2)
		})
		.optional()
});

const limit = z.object({ id, label: short, left: percent, resetsAt: time.nullable() });

export const homeSubscriptionPayload = z.object({
	id,
	provider: z.enum(['claude', 'codex']),
	plan: short.nullable(),
	account: short.nullable(),
	readAt: time,
	limits: z.array(limit).max(10),
	credits: short.nullable(),
	history: z.array(z.object({ day: z.string().date(), used: percent })).max(7),
	agents: z.array(z.object({ name: short, description: short })).max(10)
});

export const homeProviders = z.object({
	routinesReadAt: time.nullable().optional(),
	routines: z
		.array(homeRunPayload.extend({ source: z.literal('claude') }))
		.max(200)
		.nullable(),
	quota: z.array(homeSubscriptionPayload).max(20).nullable()
});

/** Provider readings are current for one hour. Missing or future timestamps are unknown. */
export function homeProviderReadingIsStale(readAt: string | null | undefined, now: number) {
	const age = now - Date.parse(readAt ?? '');
	return !Number.isFinite(age) || age < 0 || age > 3_600_000;
}
