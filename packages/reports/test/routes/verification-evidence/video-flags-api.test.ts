import { expect, test } from 'vitest';
import { GET } from '../../../src/routes/(verification-evidence)/api/video-flags/+server';

test('video-flags API returns ok', async () => {
	const response = GET();
	expect(await response.json()).toEqual({ ok: true, resource: 'video-flags' });
});
