import { expect, test } from 'vitest';
import type { RequestEvent } from '@sveltejs/kit';
import { GET } from '../../src/routes/api/replay-video/+server';
test('the video endpoint rejects missing or unsafe report selectors', async () => {
	for (const run of ['', '../private', 'file:///etc/passwd']) {
		const url = new URL('http://localhost/api/replay-video');
		url.searchParams.set('run', run);
		await expect(GET({ url, request: new Request(url) } as RequestEvent)).rejects.toMatchObject({
			status: 400
		});
	}
});
