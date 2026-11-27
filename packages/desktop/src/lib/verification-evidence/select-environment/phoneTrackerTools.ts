// @harness-uid u_whsort2vvn
import type {
	PhoneTrackerTools,
	PhoneTrackerToolSchema
} from '../../../models/development-tooling/PhoneTracker.types';
import type { RemoteNativePlugin } from '../../../models/development-tooling/Environment.types';

const confirmedWrites = {
	note: 'Append a note',
	flag: 'Flag an item',
	answer: 'Answer the current flag'
} as const;
const writeProperties = {
	id: { type: 'string', minLength: 6, maxLength: 80 },
	text: { type: 'string', minLength: 1, maxLength: 512 }
};
/** A flag or answer carries the attention revision its user reviewed, from `tracker_show`. */
const reviewedWriteInput = {
	type: 'object',
	properties: {
		...writeProperties,
		revision: { type: ['string', 'null'], maxLength: 80 }
	},
	required: ['id', 'text', 'revision'],
	additionalProperties: false
};
const noteInput = {
	type: 'object',
	properties: writeProperties,
	required: ['id', 'text'],
	additionalProperties: false
};

/** The native dispatcher owns local reads and requires an on-phone confirmation for writes. */
export const trackerToolSchemas = [
	{
		name: 'tracker_status',
		description:
			'Read status totals, unresolved flags, items that need you, and recently updated items from this phone.',
		inputSchema: { type: 'object', properties: {}, additionalProperties: false }
	},
	{
		name: 'tracker_show',
		description: 'Read one cached Tracker item and its retained notes, flag, and runs.',
		inputSchema: {
			type: 'object',
			properties: { id: { type: 'string', minLength: 6, maxLength: 80 } },
			required: ['id'],
			additionalProperties: false
		}
	},
	{
		name: 'tracker_search',
		description: 'Search this phone’s cached Tracker item IDs and titles.',
		inputSchema: {
			type: 'object',
			properties: {
				query: { type: 'string', minLength: 1, maxLength: 160 },
				project: { type: 'string', maxLength: 120 },
				status: {
					type: 'string',
					enum: ['open', 'in_progress', 'blocked', 'done', 'ignored']
				},
				limit: { type: 'integer', minimum: 1, maximum: 25, default: 10 }
			},
			required: ['query'],
			additionalProperties: false
		}
	},
	{
		name: 'tracker_write_status',
		description: 'List queued Tracker write intents and conflicts on this phone.',
		inputSchema: { type: 'object', properties: {}, additionalProperties: false }
	},
	{
		name: 'tracker_discard_write',
		description: 'Discard a blocked intent after the user reviews and confirms on the phone.',
		inputSchema: {
			type: 'object',
			properties: { intentId: { type: 'string', minLength: 36, maxLength: 36 } },
			required: ['intentId'],
			additionalProperties: false
		}
	},
	{
		name: 'tracker_done',
		description: 'Mark a reminder or item done after the user confirms it on the phone.',
		inputSchema: noteInput
	},
	{
		name: 'tracker_remind',
		description:
			'Snooze a reminder to an ISO time in `text` after the user confirms it on the phone.',
		inputSchema: noteInput
	},
	...(['note', 'flag', 'answer'] as const).map((action) => ({
		name: `tracker_${action}` as const,
		description: confirmedWrites[action] + ' after the user confirms it on the phone.',
		inputSchema: action === 'note' ? noteInput : reviewedWriteInput
	}))
] as const satisfies readonly PhoneTrackerToolSchema[];

export function phoneTrackerTools(plugin: RemoteNativePlugin): PhoneTrackerTools | undefined {
	const { trackerTool, refreshTracker } = plugin;
	if (!trackerTool || !refreshTracker) return undefined;
	return {
		schemas: trackerToolSchemas,
		call: (name, input) => trackerTool.call(plugin, { name, input }),
		refresh: () => refreshTracker.call(plugin)
	};
}
