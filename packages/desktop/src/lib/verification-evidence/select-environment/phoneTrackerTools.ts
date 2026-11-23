// @harness-uid u_whsort2vvn
import type {
	PhoneTrackerTools,
	PhoneTrackerToolSchema
} from '../../../models/development-tooling/PhoneTracker.types';
import type { RemoteNativePlugin } from '../../../models/development-tooling/Environment.types';

/** A model runner can register these schemas and invoke only the app's local read port. */
export const trackerToolSchemas = [
	{
		name: 'tracker_status',
		description:
			'Read status totals, unresolved flags, and recently updated items from this phone.',
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
	}
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
