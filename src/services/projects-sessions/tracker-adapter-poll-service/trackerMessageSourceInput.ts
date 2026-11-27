// @harness-uid u_wlip653voz
import { z } from 'zod';
import { trackerItemError } from '../../../utils/projects-sessions/trackerItemError';
import type { TrackerMessageSource } from '../../../repositories/projects-sessions/TrackerAdapterRepository.types';
import type { TrackerAdapterSourceFields } from './trackerAdapterSourceInput.types';

const domain = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const address = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[^@]+$/;
const thread = /^[a-z0-9_-]{1,128}$/;
const quietHours = /^(?:[01]\d|2[0-3]):[0-5]\d-(?:[01]\d|2[0-3]):[0-5]\d$/;
const taskSlug = z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,79}$/);

const messageMatch = z
	.strictObject({
		senders: z.array(z.string().max(254).refine(isMessageAddress)).max(20),
		domains: z.array(z.string().max(253).regex(domain)).max(20),
		threads: z.array(z.string().regex(thread)).max(20),
		keyword: z
			.string()
			.min(1)
			.max(120)
			.regex(/^[\p{L}\p{N}][\p{L}\p{M}\p{N} _'-]*$/u)
			.optional()
	})
	.refine(({ senders, domains, threads, keyword }) =>
		Boolean(senders.length || domains.length || threads.length || keyword)
	);

const messageRule = z.strictObject({
	target: z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/),
	title: z
		.string()
		.min(1)
		.max(160)
		.refine((value) => !/[\r\n]/.test(value) && !value.includes('\0')),
	match: messageMatch,
	quiet_hours: z
		.string()
		.regex(quietHours)
		.refine((value) => value.slice(0, 5) !== value.slice(6))
		.optional(),
	effect: z.discriminatedUnion('kind', [
		z.strictObject({ kind: z.literal('notify'), item_id: z.string().regex(/^[0-9a-z]{6,10}$/) }),
		z.strictObject({
			kind: z.literal('task'),
			agent: taskSlug,
			project: taskSlug,
			owner: z.string().min(1).max(80).nullable(),
			launch: z.boolean()
		})
	])
});

export function trackerMessageSourceInput(
	input: TrackerAdapterSourceFields,
	now: number
): TrackerMessageSource {
	const parsed = messageRule.safeParse({
		target: word(input, 'target').toLowerCase(),
		title: word(input, 'title'),
		match: {
			senders: list(input, 'from'),
			domains: list(input, 'domain'),
			threads: list(input, 'thread', false),
			keyword: word(input, 'keyword') || undefined
		},
		quiet_hours: word(input, 'quiet_hours') || undefined,
		effect: messageEffect(input)
	});
	if (!parsed.success)
		throw trackerItemError(
			`Invalid Gmail adapter rule (${parsed.error.issues[0]?.path.join('.') || 'rule'})`
		);
	return {
		...parsed.data,
		id: `gmail:${parsed.data.target}`,
		type: 'gmail',
		enabled_at: now,
		cursor: now,
		paused: false
	};
}

function messageEffect(input: TrackerAdapterSourceFields) {
	const notify = word(input, 'notify');
	const agent = word(input, 'agent');
	const launch = word(input, 'auto_launch') || 'never';
	if (!['never', 'match'].includes(launch))
		throw trackerItemError('Gmail auto-launch must be never or match');
	if (notify) {
		if (agent || input.project || input.owner || launch !== 'never')
			throw trackerItemError('Choose a notification item or a task route');
		return { kind: 'notify', item_id: notify };
	}
	return {
		kind: 'task',
		agent,
		project: word(input, 'project') || agent,
		owner: word(input, 'owner') || null,
		launch: launch === 'match'
	};
}

function word(input: TrackerAdapterSourceFields, key: string): string {
	const value = input[key];
	if (value === undefined) return '';
	if (typeof value !== 'string') throw trackerItemError(`Invalid Gmail adapter field: ${key}`);
	return value.trim();
}

function list(input: TrackerAdapterSourceFields, key: string, lowercase = true): string[] {
	const value = word(input, key);
	return [
		...new Set(
			(lowercase ? value.toLowerCase() : value)
				.split(',')
				.map((part) => part.trim())
				.filter(Boolean)
		)
	];
}

function isMessageAddress(value: string): boolean {
	return address.test(value) && domain.test(value.slice(value.lastIndexOf('@') + 1));
}
