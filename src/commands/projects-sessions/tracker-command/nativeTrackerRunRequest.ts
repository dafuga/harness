// @harness-uid u_r7qgepnoax
import type { NativeTrackerRequest } from './nativeTrackerCli.types';

/** Requests about runs, models and session health. */
export function nativeTrackerRunRequest(
	command: string,
	words: string[],
	values: Record<string, string | boolean | undefined>
): NativeTrackerRequest | undefined {
	switch (command) {
		case 'stop':
			return stopRequest(words);
		case 'watchdog':
			return watchdogRequest(words, values);
		case 'runs':
			if (words.length) throw new TypeError('usage: tracker runs [--item ID] [--limit N]');
			return {
				method: 'GET',
				path: '/runs' + nativeTrackerQuery({ item: values.item, limit: values.limit })
			};
		case 'models':
			if (words.length !== 1 || words[0] !== 'report')
				throw new TypeError('usage: tracker models report');
			return { method: 'GET', path: '/models/report' };
		case 'pick':
			if (words.length !== 1) throw new TypeError('usage: tracker pick <id>');
			return { method: 'GET', path: '/items/' + encodeURIComponent(words[0]) + '/pick' };
		default:
			return undefined;
	}
}

function stopRequest(words: string[]): NativeTrackerRequest {
	if (words.length !== 1) throw new TypeError('usage: tracker stop <run|item>');
	return { method: 'POST', path: '/stop?target=' + encodeURIComponent(words[0]) };
}

function watchdogRequest(
	[mode, ...trailing]: string[],
	{ item }: Record<string, string | boolean | undefined>
): NativeTrackerRequest {
	if (!trailing.length && mode === 'alerts' && !item)
		return { method: 'GET', path: '/watchdog/alerts' };
	if (!trailing.length && mode === 'dry-run')
		return { method: 'GET', path: '/watchdog/dry-run' + nativeTrackerQuery({ item }) };
	throw new TypeError('usage: tracker watchdog alerts|dry-run [--item ID]');
}

export function nativeTrackerQuery(fields: Record<string, string | boolean | undefined>): string {
	const params = new URLSearchParams();
	for (const [key, value] of Object.entries(fields)) {
		if (value !== undefined && value !== false)
			params.set(key, value === true ? '1' : String(value));
	}
	return params.size ? '?' + params.toString() : '';
}
