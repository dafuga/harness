import { expect, test } from 'vitest';
import { consoleAccess } from '../../src/utils/consoleAccess';
import { consoleStore, type ConsoleBucket } from '../../src/utils/consoleStore';

const commit = 'a'.repeat(40);
const image = `${'b'.repeat(64)}.png`;
const objects: Record<string, string> = {
	'history/index.json': '{"schemaVersion":1}',
	[`history/revisions/${commit}.json`]: '{"commit":"x"}',
	[`history/sides/${commit}.json`]: '{"schemaVersion":1,"files":[]}',
	[`history/media/${image}`]: 'PNGDATA',
	'other/index.json': '{"another":"application"}'
};
function bucket(asked: string[] = []): ConsoleBucket {
	return {
		get(key) {
			asked.push(key);
			const text = objects[key];
			if (text === undefined) return Promise.resolve(null);
			const bytes = new TextEncoder().encode(text);
			return Promise.resolve({
				text: () => Promise.resolve(text),
				arrayBuffer: () => Promise.resolve(bytes.buffer)
			});
		}
	};
}
const event = (path: string) => ({
	request: new Request(`http://host${path}`),
	url: new URL(`http://host${path}`)
});

test('consoleStore reads the index, revisions, sides and media under its prefix only', async () => {
	const asked: string[] = [];
	const data = consoleStore(bucket(asked), 'history');
	expect(await data.json('index.json')).toBe('{"schemaVersion":1}');
	expect(await data.json(`sides/${commit}.json`)).toContain('"files"');
	expect(await data.json('revisions/missing.json')).toBeUndefined();
	const media = await data.media(image);
	expect([media?.type, new TextDecoder().decode(media?.bytes)]).toEqual(['image/png', 'PNGDATA']);
	expect(await data.media(`${'c'.repeat(64)}.wav`)).toBeUndefined();
	expect(asked.every((key) => key.startsWith('history/'))).toBe(true);
});

test('a store is opened per request and only after the policy admitted it', async () => {
	const asked: string[] = [];
	let admit = false;
	const access = consoleAccess({
		policy: () => admit,
		data: () => consoleStore(bucket(asked), 'history')
	});
	const refused = [
		await access.json(event('/x'), 'index.json'),
		await access.media(event('/x'), image),
		await access.entry(event('/harness'), '/harness'),
		await access.json(event('/x'), 'build.json')
	];
	expect(refused.map((response) => response?.status)).toEqual([403, 403, 403, 403]);
	expect(asked).toEqual([]);
	admit = true;
	expect(await (await access.json(event('/x'), `sides/${commit}.json`)).text()).toContain('files');
	expect((await access.media(event('/x'), image)).status).toBe(200);
	expect(asked).toEqual([`history/sides/${commit}.json`, `history/media/${image}`]);
});

test('an admitted request can ask which build and package answered', async () => {
	const access = consoleAccess({
		policy: () => true,
		data: consoleStore(bucket(), 'history'),
		host: { revision: 'c'.repeat(40), build: `harness-build:${'0'.repeat(64)}` }
	});
	const response = await access.json(event('/x'), 'build.json');
	expect(response.headers.get('cache-control')).toBe('no-store');
	expect(await response.json()).toEqual({
		// Source checkouts are not stamped: only an emitted artifact has an identity.
		buildId: null,
		sdk: { name: '@dafuga01/harness', version: expect.stringMatching(/^\d+\.\d+\.\d+/) },
		host: { revision: 'c'.repeat(40) }
	});
	const stamped = consoleAccess({
		policy: () => true,
		data: consoleStore(bucket(), 'history'),
		host: { build: `harness-build:${'d'.repeat(64)}` }
	});
	expect(await (await stamped.json(event('/x'), 'build.json')).json()).toMatchObject({
		buildId: 'd'.repeat(64),
		host: { revision: null }
	});
});
