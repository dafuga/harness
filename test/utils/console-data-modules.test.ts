import { expect, test } from 'vitest';
import { consoleBundle } from '../../src/utils/consoleBundle';
import { consoleDataModules } from '../../src/utils/consoleDataModules';

const commit = 'a'.repeat(40);
const sha = 'b'.repeat(64);
const bytes = (text: string) => new TextEncoder().encode(text);
const png = new Uint8Array([137, 80, 78, 71, 0, 255, 10]);
const modules = consoleDataModules([
	{ path: 'index.json', bytes: bytes('{"revisions":["</script>"]}') },
	{ path: `revisions/${commit}.json`, bytes: bytes('{"commit":"a"}') },
	{ path: `media/${sha}.png`, bytes: png },
	{ path: 'notes.txt', bytes: bytes('not part of an index') },
	{ path: '../outside.json', bytes: bytes('{}') }
]);

test('index files become server modules, and anything else is left out', () => {
	expect(modules.map((file) => file.path)).toEqual([
		'src/lib/server/harness/data/index.json.ts',
		`src/lib/server/harness/data/revisions/${commit}.json.ts`,
		`src/lib/server/harness/data/media/${sha}.png.ts`
	]);
});

test('the modules give back exactly the bytes they were made from', async () => {
	// Evaluate each generated module the way a bundler would, then read it through the bundle.
	const load = (contents: string) => () => {
		const exported: Record<string, unknown> = {};
		const body = contents
			.replace(/export const (\w+) =/g, 'exported.$1 =')
			.replace('export default', 'exported.default =');
		new Function('exported', body)(exported);
		return Promise.resolve(exported);
	};
	const loaders = Object.fromEntries(
		modules.map((file) => [file.path.replace('src/lib/server/harness', '.'), load(file.contents)])
	);
	const data = consoleBundle({ json: loaders, media: loaders });
	expect(await data.json('index.json')).toBe('{"revisions":["</script>"]}');
	expect(await data.json(`revisions/${commit}.json`)).toBe('{"commit":"a"}');
	expect(await data.media(`${sha}.png`)).toEqual({ bytes: png, type: 'image/png' });
	expect(await data.media(`${'c'.repeat(64)}.png`)).toBeUndefined();
});
