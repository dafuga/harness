import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { consoleStore } from '../../src/utils/development-tooling/consoleStore';
import type {
	ConsoleBucket,
	ConsoleObject
} from '../../src/utils/development-tooling/consoleStore.types';

function object(text: string, bytes: number[]): ConsoleObject {
	const content = new Uint8Array(bytes);
	return {
		text: async () => text,
		arrayBuffer: async () => content.buffer.slice(0)
	};
}

function bucket(objects: Record<string, ConsoleObject>): ConsoleBucket {
	return {
		get: async (key) => objects[key] ?? null
	};
}

test('Reads prefixed console JSON and media types', async () => {
	const storage = bucket({
		'console/history/index.json': object('{"revision":"r1"}', []),
		'console/history/media/logo.png': object('', [137, 80]),
		'console/history/media/archive.bin': object('', [1, 2])
	});
	const store = consoleStore(storage, 'console/history///');
	const json = await store.json('index.json');
	const missing = await store.json('missing.json');
	const png = await store.media('logo.png');
	const unknown = await store.media('archive.bin');

	expect({
		json,
		missing,
		png,
		unknown: unknown && { bytes: [...unknown.bytes], type: unknown.type }
	}).toEqual({
		json: '{"revision":"r1"}',
		missing: undefined,
		png: { bytes: new Uint8Array([137, 80]), type: 'image/png' },
		unknown: { bytes: [1, 2], type: 'application/octet-stream' }
	});
	recordExampleCases(
		{
			unitId: 'function.console-store',
			symbol: 'consoleStore',
			state: 'reads-prefixed-console-json-and-media-types',
			evidence: 'examples-cases',
			file: 'reads-prefixed-console-json-and-media-types.json'
		},
		[
			{
				name: 'loads prefixed index JSON',
				input: { prefix: 'console/history///', path: 'index.json' },
				output: { key: 'console/history/index.json', json }
			},
			{
				name: 'returns undefined for absent JSON',
				input: { prefix: 'console/history///', path: 'missing.json' },
				output: { key: 'console/history/missing.json', value: missing }
			},
			{
				name: 'infers image type from media extension',
				input: { prefix: 'console/history///', name: 'logo.png' },
				output: {
					key: 'console/history/media/logo.png',
					bytes: [...(png?.bytes ?? [])],
					type: png?.type
				}
			},
			{
				name: 'uses binary fallback for unknown media extension',
				input: { prefix: 'console/history///', name: 'archive.bin' },
				output: {
					key: 'console/history/media/archive.bin',
					bytes: [...(unknown?.bytes ?? [])],
					type: unknown?.type
				}
			}
		]
	);
});

test('Throws storage error when bucket lookup rejects', async () => {
	const failure = new Error('storage unavailable');
	const storage: ConsoleBucket = {
		get: async () => Promise.reject(failure)
	};
	const store = consoleStore(storage, 'console/history');

	await expect(store.json('index.json')).rejects.toThrow('storage unavailable');
	recordExampleCases(
		{
			unitId: 'function.console-store',
			symbol: 'consoleStore',
			state: 'throws-storage-error-when-bucket-lookup-rejects',
			evidence: 'examples-cases',
			file: 'throws-storage-error-when-bucket-lookup-rejects.json'
		},
		[
			{
				name: 'propagates a rejected object lookup',
				input: { prefix: 'console/history', path: 'index.json', rejection: 'storage unavailable' },
				error: { message: failure.message }
			}
		]
	);
});
