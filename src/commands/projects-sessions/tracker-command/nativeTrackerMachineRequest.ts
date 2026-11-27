// @harness-uid u_xfvq5etye2
import type { NativeTrackerRequest } from './nativeTrackerCli.types';

export function nativeTrackerMachineRequest(
	command: string,
	[name, ...trailing]: string[],
	values: Record<string, string | boolean | undefined>
): NativeTrackerRequest | undefined {
	if (command === 'place') {
		if (name) throw new TypeError('usage: tracker place [--kind K] [--needs-ram GB]');
		return { method: 'GET', path: '/place' + search(values, ['kind', 'needs-ram']) };
	}
	if (command !== 'machines') return undefined;
	if (trailing.length || (!name && values.hours !== undefined))
		throw new TypeError('usage: tracker machines [name [--hours N]]');
	const path = name ? '/machines/' + encodeURIComponent(name) : '/machines';
	return { method: 'GET', path: path + search(values, ['hours']) };
}

function search(
	values: Record<string, string | boolean | undefined>,
	keys: readonly string[]
): string {
	const params = new URLSearchParams();
	for (const key of keys) {
		const value = values[key];
		if (typeof value === 'string') params.set(key, value);
	}
	return params.size ? '?' + params.toString() : '';
}
