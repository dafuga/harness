import { expect, test, vi } from 'vitest';
import { GET } from '../../../src/routes/(verification-evidence)/api/video-flag-frame/+server';
import { withTempRepo } from '../../../../../test/support/temporary';
import { frameFlagFixture, hash } from '../../../../../test/support/frameFlagFixture';
import { FrameFlagService } from '../../../../../src/services/verification-evidence/FrameFlagService';
import { writeFile } from 'node:fs/promises';
import { LfsAdapter } from '../../../../../src/adapters/git-source-history/LfsAdapter';

const site = vi.hoisted(() => ({ root: '' }));
vi.mock('../../../src/utils/reports-media/reportSite', () => ({ reportSite: () => site }));
const get = GET as (event: { url: URL; request: Request }) => Promise<Response>;

test('video-flag-frame API returns ok', async () => {
	await withTempRepo(async ({ root, git }) => {
		site.root = root;
		const f = await frameFlagFixture(root, git);
		const flag = await new FrameFlagService(root, f.reader).flag({
			clip: f.reference,
			frameNumber: 2
		});
		const url = new URL('http://127.0.0.1:5792/api/video-flag-frame');
		const request = new Request(url);
		expect((await get({ url, request })).status, 'unsafe frame selectors are refused').toBe(400);
		url.searchParams.set('unit', f.reference.unit);
		url.searchParams.set('id', flag.id);
		const response = await get({ url, request });
		expect(response.status).toBe(200);
		expect(response.headers.get('content-type')).toContain('image/png');
		expect(hash(Buffer.from(await response.arrayBuffer()))).toBe(flag.frame.sha256);
		url.searchParams.set('unit', 'component.other');
		expect((await get({ url, request })).status).toBe(404);
		url.searchParams.set('unit', f.reference.unit);
		await writeFile(await new LfsAdapter(root).path(flag.frame.sha256), 'corrupt');
		expect((await get({ url, request })).status).toBe(400);
	});
});
