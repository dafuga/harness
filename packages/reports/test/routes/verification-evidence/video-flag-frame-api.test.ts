import { expect, test } from 'vitest';
import { GET } from '../../../src/routes/(verification-evidence)/api/video-flag-frame/+server';

test('video-flag-frame API returns ok', async () => {
	const response = GET();
	expect(await response.json()).toEqual({ ok: true, resource: 'video-flag-frame' });
});
