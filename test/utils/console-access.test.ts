import { expect, test } from 'vitest';
import { consoleAccess } from '../../src/utils/consoleAccess';
import { consoleBundle } from '../../src/utils/consoleBundle';

const commit = 'a'.repeat(40);
const image = `${'b'.repeat(64)}.png`;
const data = consoleBundle({
	json: {
		'/data/index.json.ts': () => Promise.resolve({ default: '{"schemaVersion":1}' }),
		[`/data/revisions/${commit}.json.ts`]: () => Promise.resolve({ default: '{"commit":"x"}' })
	},
	media: {
		[`/data/media/${image}.ts`]: () =>
			Promise.resolve({ default: btoa('PNGDATA'), type: 'image/png' })
	}
});
const event = (path: string, headers: Record<string, string> = {}) => ({
	request: new Request(`http://host${path}`, { headers }),
	url: new URL(`http://host${path}`)
});
const open = consoleAccess({ policy: () => true, data });

test('consoleAccess refuses everything unless the policy returns exactly true', async () => {
	const policies = [
		() => false,
		() => Promise.reject(new Error('no session')),
		() => 1 as unknown as boolean
	];
	for (const policy of policies) {
		const closed = consoleAccess({ policy, data });
		const responses = [
			await closed.guard(event('/harness')),
			await closed.json(event('/x'), 'index.json'),
			await closed.media(event('/x'), image)
		];
		expect(responses.map((response) => response?.status)).toEqual([403, 403, 403]);
		expect(await responses[1]?.text()).toBe('Forbidden');
	}
	expect(await open.guard(event('/harness'))).toBeUndefined();
});

test('consoleAccess serves only the index, revision files and hashed media', async () => {
	expect(await (await open.json(event('/x'), 'index.json')).text()).toBe('{"schemaVersion":1}');
	expect((await open.json(event('/x'), `revisions/${commit}.json`)).status).toBe(200);
	for (const path of ['../secret.json', 'revisions/../index.json', 'index', 'media/x.json']) {
		expect([path, (await open.json(event('/x'), path)).status]).toEqual([path, 404]);
	}
	const media = await open.media(event('/x'), image);
	expect([media.status, media.headers.get('content-type'), await media.text()]).toEqual([
		200,
		'image/png',
		'PNGDATA'
	]);
	expect(media.headers.get('cache-control')).toContain('private');
	expect((await open.media(event('/x'), '../index.json')).status).toBe(404);
	expect((await open.media(event('/x'), `${'c'.repeat(64)}.png`)).status).toBe(404);
});

test('consoleAccess answers byte ranges so audio can seek', async () => {
	const part = await open.media(event('/x', { range: 'bytes=3-6' }), image);
	expect([part.status, part.headers.get('content-range'), await part.text()]).toEqual([
		206,
		'bytes 3-6/7',
		'DATA'
	]);
	const tail = await open.media(event('/x', { range: 'bytes=-3' }), image);
	expect(await tail.text()).toBe('ATA');
	expect((await open.media(event('/x', { range: 'bytes=9-' }), image)).status).toBe(416);
});

test('a portable report is built only for an admitted request, from the data the host holds', async () => {
	const asked: Array<{ commit: string; record: string | null; index: string; detail: string }> = [];
	const exporting = (policy: () => boolean) =>
		consoleAccess({
			policy,
			data,
			exporter: async (input) => {
				asked.push({ ...input });
				const shot = await input.media(image);
				return input.record === 'none' ? undefined : `<html>${shot?.type}</html>`;
			}
		});
	const denied = await exporting(() => false).report(event('/x'), commit, null);
	expect([denied.status, asked]).toEqual([403, []]);

	const served = await exporting(() => true).report(event('/x'), commit, 'r1');
	expect(served.status).toBe(200);
	expect(await served.text()).toBe('<html>image/png</html>');
	expect(served.headers.get('content-type')).toBe('text/html; charset=utf-8');
	expect(served.headers.get('cache-control')).toBe('private, no-store');
	expect(served.headers.get('content-disposition')).toBe(
		`attachment; filename="harness-${commit.slice(0, 12)}.html"`
	);
	expect(asked).toEqual([
		{
			commit,
			record: 'r1',
			index: '{"schemaVersion":1}',
			detail: '{"commit":"x"}',
			media: expect.any(Function)
		}
	]);
	const admitted = exporting(() => true);
	const missing = [
		await admitted.report(event('/x'), 'c'.repeat(40), null),
		await admitted.report(event('/x'), '../index', null),
		await admitted.report(event('/x'), commit, 'none'),
		await open.report(event('/x'), commit, null)
	];
	expect(missing.map((response) => response.status)).toEqual([404, 404, 404, 404]);
});

test('the root and the earlier query form are redirected into the explorer, after the policy', async () => {
	const head = 'd'.repeat(40);
	const history = consoleBundle({
		json: {
			'/data/index.json.ts': () =>
				Promise.resolve({
					default: JSON.stringify({
						branches: [{ name: 'feat/x', head }],
						revisions: [{ commit: head, branches: ['feat/x'] }]
					})
				})
		},
		media: {}
	});
	const admitted = consoleAccess({ policy: () => true, data: history });
	const root = await admitted.entry(event('/harness'), '/harness');
	expect([root?.status, root?.headers.get('location')]).toEqual([
		308,
		'/harness/branch/feat%2Fx/pages'
	]);
	const legacy = await admitted.entry(event(`/harness?view=history&commit=${head}`), '/harness');
	expect(legacy?.headers.get('location')).toBe(`/harness/branch/feat%2Fx/commit/${head}/pages`);
	// An explorer address is served as it is, with its tab, and so is an earlier page path: the
	// viewer leads on from it. A stranger learns nothing from any form.
	const page = '/harness/branch/feat%2Fx/pages';
	expect(await admitted.entry(event(page), '/harness')).toBeUndefined();
	const source = `/harness/branch/feat%2Fx/commit/${head}/pages/page.titles/details?tab=source`;
	expect(await admitted.entry(event(source), '/harness')).toBeUndefined();
	const earlier = `/harness/branch/feat/x/commit/${head}/map`;
	expect(await admitted.entry(event(earlier), '/harness')).toBeUndefined();
	const closed = consoleAccess({ policy: () => false, data: history });
	for (const address of ['/harness', page, `/harness?commit=${head}`]) {
		const refused = await closed.entry(event(address), '/harness');
		expect([refused?.status, refused?.headers.get('location')]).toEqual([403, null]);
	}
});
