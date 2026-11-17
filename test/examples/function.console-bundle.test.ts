import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { consoleBundle } from '../../src/utils/development-tooling/consoleBundle';
import type { ConsoleModules } from '../../src/utils/development-tooling/consoleBundle.types';

function recordReadCases(json: string | undefined, media: { bytes: Uint8Array; type: string } | undefined, missing: string | undefined) {
	const state = 'lazily-reads-bundled-json-and-media-modules';
	recordExampleCases(
		{ unitId: 'function.console-bundle', symbol: 'consoleBundle', state, evidence: 'examples-cases', file: `${state}.json` },
		[
			{ name: 'JSON text is returned unchanged when requested', input: { method: 'json', path: 'index' }, output: json },
			{ name: 'base64 media is decoded on request', input: { method: 'media', name: 'logo' }, output: media && { bytes: Array.from(media.bytes), type: media.type } },
			{ name: 'unmatched paths resolve to undefined', input: { method: 'json', path: 'missing' }, output: { isUndefined: missing === undefined } }
		]
	);
}

test('Lazily reads bundled JSON and media modules', async () => {
	let jsonLoads = 0;
	let mediaLoads = 0;
	const modules: ConsoleModules = {
		json: { '/console/index.ts': async () => { jsonLoads += 1; return { default: '{"title":"Example"}' }; } },
		media: { '/console/logo.ts': async () => { mediaLoads += 1; return { default: 'AQID', type: 'image/example' }; } }
	};
	const reader = consoleBundle(modules);
	expect([jsonLoads, mediaLoads]).toEqual([0, 0]);
	const json = await reader.json('index');
	const media = await reader.media('logo');
	const missing = await reader.json('missing');
	expect(json).toBe('{"title":"Example"}');
	expect(media && { bytes: Array.from(media.bytes), type: media.type }).toEqual({ bytes: [1, 2, 3], type: 'image/example' });
	expect(missing).toBeUndefined();
	expect([jsonLoads, mediaLoads]).toEqual([1, 1]);
	recordReadCases(json, media, missing);
});

test('Throws InvalidCharacterError when media contains invalid base64', async () => {
	const reader = consoleBundle({
		json: {},
		media: { '/console/bad.ts': async () => ({ default: 'not base64!', type: 'image/example' }) }
	});
	let errorName = '';
	try {
		await reader.media('bad');
	} catch (error) {
		errorName = error instanceof Error ? error.name : '';
	}
	expect(errorName).toBe('InvalidCharacterError');
	recordExampleCases(
		{ unitId: 'function.console-bundle', symbol: 'consoleBundle.media', state: 'throws-invalidcharactererror-when-media-contains-invalid-bas', evidence: 'examples-cases', file: 'throws-invalidcharactererror-when-media-contains-invalid-bas.json' },
		[{ name: 'Invalid base64 rejects media decoding', input: { method: 'media', name: 'bad', default: 'not base64!' }, error: { name: errorName } }]
	);
});

test('Throws loader error when a JSON loader rejects', async () => {
	const failure = { code: 'fixture-loader-failure' };
	const reader = consoleBundle({ json: { '/console/index.ts': async () => { throw failure; } }, media: {} });
	let received: unknown;
	try {
		await reader.json('index');
	} catch (error) {
		received = error;
	}
	expect(received).toBe(failure);
	recordExampleCases(
		{ unitId: 'function.console-bundle', symbol: 'consoleBundle.json', state: 'throws-loader-error-when-a-json-loader-rejects', evidence: 'examples-cases', file: 'throws-loader-error-when-a-json-loader-rejects.json' },
		[{ name: 'JSON loader rejection propagates unchanged', input: { method: 'json', path: 'index', rejection: failure }, error: failure }]
	);
});
