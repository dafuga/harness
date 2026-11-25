import { z } from 'zod';
import {
	homeProviders,
	homeRunPayload
} from '$reports/lib/projects-sessions/hub-home/homeProviderPayload';
import { sanitizeText } from '$reports/lib/projects-sessions/project-overview/projectOverviewPrivacy';
import { parseOverviewPayload } from '../tracker-overview/trackerOverviewInput';

const text = (max: number) =>
	z
		.string()
		.max(max)
		.transform((value) => sanitizeText(value));
const id = z.string().min(1).max(200);
const time = z.string().datetime();
const short = text(200);
const title = text(500);
const unsigned = z.number().int().min(0).max(100000);

const message = z.object({
	id,
	text: text(2000),
	at: time,
	from: z.enum(['agent', 'you'])
});

const askOption = z
	.object({ label: text(80).refine((value) => value.trim().length > 0), effect: text(400) })
	.extend({ recommended: z.literal(true).optional() });

// Two to four choices with at most one recommended, or none at all. Older Macs send none.
const options = z
	.array(askOption)
	.min(2)
	.max(4)
	.refine((list) => list.filter((entry) => entry.recommended).length <= 1)
	.optional();

const agent = z.object({
	id,
	name: short,
	state: z.enum(['needs-you', 'working', 'idle', 'offline']),
	// Older Mac apps omit these; zero sessions and no tasks is what they meant.
	sessions: unsigned.default(0),
	tasks: z
		.array(z.object({ itemId: id, title, machine: short.nullable() }))
		.max(5)
		.default([]),
	itemId: id.nullable(),
	task: title,
	machine: short.nullable(),
	model: short.nullable(),
	since: time,
	question: text(2000).nullable(),
	options,
	confirm: z.enum(['deploy', 'money', 'secret']).optional(),
	messages: z.array(message).max(20)
});

const plan = z
	.object({
		id,
		title,
		project: short.nullable(),
		state: z.enum(['draft', 'in-review', 'approved', 'in-progress', 'done']),
		updatedAt: time,
		total: unsigned,
		done: unsigned,
		steps: z.array(z.object({ id, title, done: z.boolean() })).max(30)
	})
	.refine((value) => value.done <= value.total);

const snapshot = z.object({
	overview: z.unknown(),
	agents: z.array(agent).max(100),
	plans: z.array(plan).max(100),
	scheduled: z.array(homeRunPayload).max(200),
	providers: homeProviders
});

export function parseHomePayload(value: unknown) {
	const result = snapshot.parse(value);
	const overview = parseOverviewPayload(JSON.stringify(result.overview));
	return { ...result, overview };
}

export const chatId = z.string().uuid();

export const chatInput = z
	.object({
		id: chatId,
		agentId: id,
		itemId: id,
		kind: z.enum(['note', 'answer']),
		question: text(2000).nullable(),
		text: text(2000).refine((value) => value.trim().length > 0),
		option: z.number().int().min(1).max(4).optional(),
		confirmed: z.literal(true).optional()
	})
	.strict()
	.refine((value) => (value.kind === 'answer') === Boolean(value.question))
	.refine((value) => value.option === undefined || value.kind === 'answer')
	.refine((value) => value.confirmed === undefined || value.option !== undefined);

export const chatOutcome = z
	.object({
		id: chatId,
		status: z.enum(['sent', 'refused', 'unconfirmed'])
	})
	.strict();
