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

const agent = z.object({
	id,
	name: short,
	state: z.enum(['needs-you', 'working', 'idle', 'offline']),
	itemId: id.nullable(),
	task: title,
	machine: short.nullable(),
	model: short.nullable(),
	since: time,
	question: text(2000).nullable(),
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
		text: text(2000).refine((value) => value.trim().length > 0)
	})
	.strict()
	.refine((value) => (value.kind === 'answer') === Boolean(value.question));

export const chatOutcome = z
	.object({
		id: chatId,
		status: z.enum(['sent', 'refused', 'unconfirmed'])
	})
	.strict();
