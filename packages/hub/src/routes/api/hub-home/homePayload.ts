import { z } from 'zod';
import {
	chatId,
	homeChatInput,
	homeRunId
} from '$reports/lib/projects-sessions/hub-home/homeChatInput';
import {
	homeProviders,
	homeRunPayload
} from '$reports/lib/projects-sessions/hub-home/homeProviderPayload';
import { controlledIdPattern } from '$reports/lib/projects-sessions/hub-home/homeDirectAgents';
import { sanitizeText } from '$reports/lib/projects-sessions/project-overview/projectOverviewPrivacy';
import {
	trackerArtifactMaxBytes,
	trackerPlanningSchema,
	trackerStageSchema
} from '../../../../../../src/utils/projects-sessions/trackerPlanning';
import { trackerAttachmentLimits } from '../../../../../../src/utils/projects-sessions/trackerAttachmentLimits';
import { trackerAttachmentSchema } from '../../../../../../src/utils/projects-sessions/trackerAttachments';
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

const task = z.object({ itemId: id, title, machine: short.nullable() });
const message = z.object({
	id,
	text: text(2000),
	at: time,
	from: z.enum(['agent', 'you']),
	// Hub messages and replies; older Macs send plain notes without them.
	messageId: id.optional(),
	status: z.enum(['stored', 'delivered', 'acknowledged', 'refused']).optional(),
	reason: text(300).optional(),
	replyTo: id.optional()
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
	tasks: z.array(task).max(5).default([]),
	subAgents: z
		.object({ sessions: unsigned.default(0), tasks: z.array(task).max(5).default([]) })
		.default({ sessions: 0, tasks: [] }),
	itemId: id.nullable(),
	runId: homeRunId.nullable().optional(),
	task: title,
	machine: short.nullable(),
	model: short.nullable(),
	since: time,
	question: text(2000).nullable(),
	options,
	confirm: z.enum(['deploy', 'money', 'secret']).optional(),
	messages: z.array(message).max(20)
});

// A listed ask is always answerable by tap: 2 to 4 choices, exactly one recommended.
const openAsk = z.object({
	itemId: id,
	agentId: id,
	agentName: short,
	title,
	question: text(2000),
	options: z
		.array(askOption)
		.min(2)
		.max(4)
		.refine((list) => list.filter((entry) => entry.recommended).length === 1),
	confirm: z.enum(['deploy', 'money', 'secret']).optional(),
	// Only the listing is part of the snapshot; documents are stored apart. Older Macs send none.
	attachments: z.array(trackerAttachmentSchema).max(trackerAttachmentLimits.count).optional(),
	since: time
});

const reminder = z.object({
	itemId: id,
	title,
	at: time,
	repeats: short.nullable(),
	group: z.enum(['work', 'personal']).optional(),
	project: short.nullable().optional(),
	due: time.optional(),
	allDay: z.literal(true).optional(),
	updatedAt: time
});

const planning = trackerPlanningSchema.refine(
	({ artifacts }) =>
		Object.values(artifacts).every(
			(artifact) =>
				new TextEncoder().encode(JSON.stringify(artifact)).byteLength <= trackerArtifactMaxBytes
		),
	'Each stage artifact must fit the Tracker limit'
);

const plan = z
	.object({
		id,
		title,
		project: short.nullable(),
		state: z.enum(['draft', 'in-review', 'approved', 'in-progress', 'done']),
		stage: trackerStageSchema.optional(),
		planning: planning.optional(),
		updatedAt: time,
		total: unsigned,
		done: unsigned,
		steps: z.array(z.object({ id, title, done: z.boolean() })).max(30)
	})
	.refine((value) => value.done <= value.total);

const snapshot = z.object({
	overview: z.unknown(),
	providerPreference: z.object({ provider: z.literal('claude'), until: time }).optional(),
	projectDirectory: z
		.array(
			z.object({
				name: short,
				state: z.enum(['needs-you', 'blocked', 'active', 'quiet', 'done']),
				needsYou: unsigned
			})
		)
		.optional(),
	agents: z.array(agent).max(100),
	openAsks: z.array(openAsk).max(100).optional(),
	reminders: z.array(reminder).max(100).optional(),
	plans: z.array(plan).max(100),
	scheduled: z.array(homeRunPayload).max(200),
	overdue: z.array(homeRunPayload).max(200).optional(),
	providers: homeProviders
});

export function parseHomePayload(value: unknown) {
	// Every Tracker project is kept; Home lists the user-controlled ones when it is read.
	const result = snapshot.parse(value);
	const overview = parseOverviewPayload(JSON.stringify(result.overview));
	return { ...result, overview };
}

export { chatId, homeChatInput as chatInput };

export const chatOutcome = z
	.object({
		id: chatId,
		status: z.enum(['sent', 'refused', 'unconfirmed'])
	})
	.strict();

/** A Tracker agent value Daniel adds or removes as a session he controls himself. */
export const controlledChange = z.object({ id: z.string().regex(controlledIdPattern) });
export const controlledIds = z.array(z.string().regex(controlledIdPattern)).max(20);
