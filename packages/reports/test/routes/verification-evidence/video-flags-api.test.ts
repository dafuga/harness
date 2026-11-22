import { expect, test, vi } from 'vitest';
import * as endpoint from '../../../src/routes/(verification-evidence)/api/video-flags/+server';
import { withTempRepo } from '../../../../../test/support/temporary';
import { frameFlagFixture } from '../../../../../test/support/frameFlagFixture';
import { attachedFrameFixture } from '../../../../../test/support/attachedFrameFixture';

const site = vi.hoisted(() => ({ root: '' }));
vi.mock('../../../src/utils/reports-media/reportSite', () => ({ reportSite: () => site }));
const origin = 'http://127.0.0.1:5792';
const get = endpoint.GET as (event: { url: URL }) => Promise<Response>;
const post = endpoint.POST as (event: { request: Request; url: URL }) => Promise<Response>;

test('video-flags API returns ok', async () => {
	await withTempRepo(async ({ root, git }) => {
		site.root = root;
		const f = await frameFlagFixture(root, git);
		const url = new URL(origin + '/api/video-flags');
		expect((await get({ url })).status, 'invalid selector is refused').toBe(400);
		const clip = await attachedFrameFixture({
			root,
			git,
			reference: f.reference,
			video: f.original,
			standing: 'scoped'
		});
		const request = new Request(url, {
			method: 'POST',
			headers: { Origin: origin, 'Content-Type': 'application/json' },
			body: JSON.stringify({ clip, frameNumber: 2, note: 'Inspect this transition' })
		});
		const response = await post({ request, url });
		expect(response.status).toBe(201);
		const { flag } = await response.json();
		expect(flag).toMatchObject({
			clip: { record: clip.record },
			frameNumber: 2,
			note: 'Inspect this transition'
		});
		url.searchParams.set('unit', clip.unit);
		url.searchParams.set('clipId', clip.clipId);
		url.searchParams.set('viewport', clip.viewport);
		url.searchParams.set('sha256', 'e'.repeat(64));
		expect(await (await get({ url })).json()).toMatchObject({
			flags: [{ id: flag.id, status: 'stale' }]
		});
		await assertAdmission(url);
	});
});

async function assertAdmission(url: URL) {
	for (const [headers, status] of [
		[{ 'Content-Type': 'application/json' }, 403],
		[{ Origin: 'https://other.example', 'Content-Type': 'application/json' }, 403],
		[{ Origin: origin, 'Content-Type': 'text/plain' }, 415],
		[{ Origin: origin, 'Content-Type': 'application/json', 'Content-Length': '8193' }, 413]
	] as const) {
		const request = new Request(url, { method: 'POST', headers, body: '{}' });
		const read = vi.spyOn(request, 'body', 'get');
		expect((await post({ request, url })).status).toBe(status);
		expect(read).not.toHaveBeenCalled();
	}
	for (const body of ['{bad', 'x'.repeat(8193), JSON.stringify({ clip: {}, frameNumber: 2 })]) {
		const request = new Request(url, {
			method: 'POST',
			headers: { Origin: origin, 'Content-Type': 'application/json' },
			body
		});
		expect((await post({ request, url })).status).toBe(body.length > 8192 ? 413 : 400);
	}
}
