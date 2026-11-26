// @harness-uid u_r7qgepnoax
import type { NativeTrackerRefusal } from './nativeTrackerCli.types';
import { formatNativeTrackerMatches } from './formatNativeTrackerMatches';

const duplicateExits: Record<string, number> = { ignored_duplicate: 4, open_duplicate: 5 };

/** Print a refused request and return its exit code; duplicates list every match. */
export function printNativeTrackerError(status: number, data: NativeTrackerRefusal): number {
	if (status === 404 && !data?.error) {
		console.error('tracker: the configured listener does not serve native Tracker commands');
		return 3;
	}
	const exit = duplicateExits[data?.code ?? ''] ?? 1;
	console.error(refusalMessage(status, data));
	return exit;
}

function refusalMessage(status: number, { error, code = '', matches }: NativeTrackerRefusal) {
	if (!Object.hasOwn(duplicateExits, code) || !matches?.length)
		return `tracker: ${error ?? `HTTP ${status}`}`;
	const ignored = code === 'ignored_duplicate';
	return formatNativeTrackerMatches(
		{ ignored: ignored ? matches : [], open: ignored ? [] : matches },
		'tracker: not done - '
	);
}
