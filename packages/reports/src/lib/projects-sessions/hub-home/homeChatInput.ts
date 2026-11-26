// @harness-uid u_shlebgkfvv
import { z } from 'zod';
import { sanitizeText } from '../project-overview/projectOverviewPrivacy';

const text = z
	.string()
	.max(2000)
	.transform((value) => sanitizeText(value));
const id = z.string().min(1).max(200);

export const chatId = z.string().uuid();

/** One Home write: a note on an agent's item, an answer to its open ask, or a reminder tap. */
export const homeChatInput = z
	.object({
		id: chatId,
		agentId: id,
		itemId: id,
		kind: z.enum(['note', 'answer', 'reminder-done', 'reminder-snooze']),
		question: text.nullable(),
		text: text.refine((value) => value.trim().length > 0),
		option: z.number().int().min(1).max(4).optional(),
		confirmed: z.literal(true).optional(),
		armed: z.string().datetime().optional(),
		until: z.string().datetime().optional()
	})
	.strict()
	.refine((value) => (value.kind === 'answer') === Boolean(value.question))
	.refine((value) => value.option === undefined || value.kind === 'answer')
	.refine((value) => value.confirmed === undefined || value.option !== undefined)
	.refine((value) => value.kind.startsWith('reminder-') === (value.armed !== undefined))
	.refine((value) => (value.kind === 'reminder-snooze') === (value.until !== undefined));
