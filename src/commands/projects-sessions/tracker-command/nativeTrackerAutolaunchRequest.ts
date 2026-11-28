// @harness-uid u_r7qgepnoax
import type { NativeTrackerRequest } from './nativeTrackerCli.types';

const autolaunchUsage = 'usage: tracker autolaunch status|dry-run|pause|resume|clear-quota';
const preferUsage =
	'usage: tracker autolaunch prefer claude --until <ISO> | prefer default | pause codex --until <ISO> | resume codex';

export function nativeTrackerAutolaunchRequest(
	[mode, ...rest]: string[],
	until?: string | boolean
): NativeTrackerRequest | undefined {
	const end = typeof until === 'string' ? until : undefined;
	if (mode === 'prefer') return preferRequest(rest, end);
	if ((mode === 'pause' || mode === 'resume') && rest[0] === 'codex')
		return codexRequest(mode, rest.slice(1), end);
	if (end !== undefined) throw new TypeError(preferUsage);
	if (mode === 'clear-quota') {
		const [provider, ...trailing] = rest;
		if (trailing.length || (provider !== 'codex' && provider !== 'claude'))
			throw new TypeError('usage: tracker autolaunch clear-quota <codex|claude>');
		return { method: 'POST', path: '/autolaunch/clear-quota', body: { provider } };
	}
	if (mode !== 'pause' && mode !== 'resume') return undefined;
	if (rest.length) throw new TypeError(autolaunchUsage);
	return { method: 'POST', path: '/autolaunch/' + mode };
}

function preferRequest([provider, ...rest]: string[], until?: string): NativeTrackerRequest {
	if (!rest.length && provider === 'claude' && until) return preference('claude', until);
	if (!rest.length && provider === 'default' && !until) return preference(null);
	throw new TypeError(preferUsage);
}

// Pausing Codex means launches go to Claude until then, not that work waits.
function codexRequest(mode: 'pause' | 'resume', rest: string[], until?: string) {
	const pause = mode === 'pause';
	if (rest.length || pause !== Boolean(until)) throw new TypeError(preferUsage);
	return preference(pause ? 'claude' : null, until);
}

function preference(provider: 'claude' | null, until?: string): NativeTrackerRequest {
	return {
		method: 'POST',
		path: '/autolaunch/prefer',
		body: { provider, ...(until && { until }) }
	};
}
