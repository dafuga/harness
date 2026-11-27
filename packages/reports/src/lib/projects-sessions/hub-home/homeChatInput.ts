// @harness-uid u_shlebgkfvv
import { z } from 'zod';
import { sanitizeText } from '../project-overview/projectOverviewPrivacy';

const text = z
	.string()
	.max(2000)
	.transform((value) => sanitizeText(value));
const id = z.string().min(1).max(200);

export const chatId = z.string().uuid();

/** `<computer>#<run>`: one exact Tracker run, never "whichever session is there now". */
export const homeRunId = z.string().regex(/^[^\s#]{1,100}#[1-9][0-9]{0,15}$/);

/**
 * One Home write: a note on an agent's item, an answer to its open ask, a message typed into
 * Chief of Staff's pane (item `cos`) or into the one live run it names, or a reminder tap.
 */
export const homeChatInput = z
	.object({
		id: chatId,
		agentId: id,
		itemId: id,
		kind: z.enum(['note', 'answer', 'message', 'reminder-done', 'reminder-snooze']),
		question: text.nullable(),
		text: text.refine((value) => value.trim().length > 0),
		option: z.number().int().min(1).max(4).optional(),
		confirmed: z.literal(true).optional(),
		runId: homeRunId.optional(),
		armed: z.string().datetime().optional(),
		until: z.string().datetime().optional()
	})
	.strict()
	.refine((value) => (value.kind === 'answer') === Boolean(value.question))
	.refine((value) => value.option === undefined || value.kind === 'answer')
	.refine((value) => value.confirmed === undefined || value.option !== undefined)
	.refine((value) => value.runId === undefined || value.kind === 'message')
	.refine(
		(value) =>
			value.kind !== 'message' ||
			(value.agentId === 'cos' ? value.itemId === 'cos' && !value.runId : Boolean(value.runId))
	)
	.refine((value) => value.kind.startsWith('reminder-') === (value.armed !== undefined))
	.refine((value) => (value.kind === 'reminder-snooze') === (value.until !== undefined));
