// @harness-uid u_r7qgepnoax
import type { NativeTrackerRequest } from './nativeTrackerCli.types';

const inspectionRoutes = new Map<string, Record<string, string>>([
	['autolaunch', { status: '/autolaunch', 'dry-run': '/autolaunch/dry-run' }],
	['adapter', { list: '/adapters' }],
	['backup', { list: '/backup/list' }]
]);

function nativeTrackerAdapterRequest(
	[mode, source, ...trailing]: string[],
	values: Record<string, string | boolean | undefined>
): NativeTrackerRequest | undefined {
	if (mode !== 'run') {
		if (values['dry-run'] || values['backfill-comments'])
			throw new TypeError('adapter polling flags require adapter run');
		return undefined;
	}
	if (!source || trailing.length)
		throw new TypeError('usage: tracker adapter run <source> [--backfill-comments] [--dry-run]');
	const query = new URLSearchParams({ source });
	for (const flag of ['dry-run', 'backfill-comments']) if (values[flag]) query.set(flag, '1');
	return { method: 'POST', path: '/adapters/run?' + query };
}

export function nativeTrackerInspectionRequest(
	command: string,
	words: string[],
	values: Record<string, string | boolean | undefined>
): NativeTrackerRequest | undefined {
	if (command === 'backup' && words.join() === 'now')
		return { method: 'POST', path: '/backup/now' };
	const adapter = command === 'adapter' ? nativeTrackerAdapterRequest(words, values) : undefined;
	return adapter ?? nativeTrackerReadInspection(command, words);
}

function nativeTrackerReadInspection(
	command: string,
	words: string[]
): NativeTrackerRequest | undefined {
	const routes = inspectionRoutes.get(command);
	if (!routes) return undefined;
	const sub = words[0] ?? (command === 'autolaunch' ? 'status' : '');
	if (words.length > 1 || !Object.hasOwn(routes, sub))
		throw new TypeError(`usage: tracker ${command} ${Object.keys(routes).join('|')}`);
	return { method: 'GET', path: routes[sub] };
}
