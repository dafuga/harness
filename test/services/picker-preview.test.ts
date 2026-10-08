import { expect, test } from 'vitest';
import { PickerPreviewService } from '../../src/services/PickerPreviewService';
import { ProviderSwitchService } from '../../src/services/ProviderSwitchService';
import { createPickerFixture } from '../support/picker';

test('preview confines writes to its synthetic session and rejects foreign hosts/origins', async () => {
	const { store, catalog, target } = createPickerFixture();
	const origin = 'http://127.0.0.1:47839';
	const preview = new PickerPreviewService(
		new ProviderSwitchService(store, catalog),
		'<body>fixture</body>',
		origin
	);
	const post = (site: string | null, sessionId: string) =>
		new Request(origin + '/tools', {
			method: 'POST',
			headers: site ? { Origin: site } : {},
			body: JSON.stringify({
				name: 'request_model_switch',
				arguments: { session_id: sessionId, ...target }
			})
		});
	expect((await preview.fetch(post('https://elsewhere.test', 'preview-session'))).status).toBe(403);
	expect((await preview.fetch(post(null, 'preview-session'))).status).toBe(403);
	expect((await preview.fetch(post(origin, 'real-desktop-session'))).status).toBe(400);
	expect((await preview.fetch(new Request('http://evil.test:47839/preview'))).status).toBe(403);
	expect(store.list()).toEqual([]);
	expect((await preview.fetch(post(origin, 'preview-session'))).status).toBe(200);
	expect(store.list()).toHaveLength(1);
});
