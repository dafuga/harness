// @harness-uid u_r7qgepnoax
import type { NativeTrackerRequest } from './nativeTrackerCli.types';

const autolaunchUsage =
	'usage: tracker autolaunch status|dry-run|pause|resume|clear-quota|provider';
const providerPath = '/autolaunch/provider';

export function nativeTrackerAutolaunchRequest([mode, ...rest]: string[]):
	| NativeTrackerRequest
	| undefined {
	if (mode === 'provider') return providerRequest(rest);
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

function providerRequest([provider, until, then, ...trailing]: string[]): NativeTrackerRequest {
	if (!provider) return { method: 'GET', path: providerPath };
	if (provider === 'default' && !until)
		return { method: 'POST', path: providerPath, body: { setting: null } };
	if (trailing.length || (provider !== 'codex' && provider !== 'claude'))
		throw new TypeError(
			'usage: tracker autolaunch provider [default|codex|claude [<ISO time> [codex|claude]]]'
		);
	return {
		method: 'POST',
		path: providerPath,
		body: { setting: { provider, ...(until && { until }), ...(then && { then }) } }
	};
}
