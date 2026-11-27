// @harness-uid u_yaelw2ot4c
import { homedir } from 'node:os';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { canarySurfaces } from './runCanary';
import type { CanarySurface } from './canary.types';

export const canaryUsage =
	'usage: bun scripts/needs-you-canary.ts --release <item id> [--tap web,mac,iphone] [--tap-minutes N] [--tracker PATH]';

export function canaryArguments(args: string[]) {
	const { values } = parseArgs({
		args,
		options: {
			release: { type: 'string' },
			tap: { type: 'string' },
			'tap-minutes': { type: 'string', default: '10' },
			tracker: { type: 'string', default: join(homedir(), '.local/bin/tracker') }
		}
	});
	if (!values.release) throw new TypeError(canaryUsage);
	const minutes = Number(values['tap-minutes']);
	if (!(minutes > 0)) throw new TypeError('--tap-minutes must be a number above 0');
	return {
		release: values.release,
		taps: tappedSurfaces(values.tap),
		tapTimeoutMs: minutes * 60_000,
		tracker: values.tracker
	};
}

function tappedSurfaces(list: string | undefined): Set<CanarySurface> {
	const words = list ? list.split(',').map((word) => word.trim()) : [];
	const unknown = words.find((word) => !canarySurfaces.includes(word as CanarySurface));
	if (unknown !== undefined)
		throw new TypeError(`--tap takes ${canarySurfaces.join(', ')}; got "${unknown}"`);
	return new Set(words as CanarySurface[]);
}
