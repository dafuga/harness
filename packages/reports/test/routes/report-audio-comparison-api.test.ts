import { expect, test } from 'vitest';
import { POST } from '../../src/routes/api/report-audio-comparison/+server';
async function attempt(headers: Record<string, string>) {
	const request = new Request('http://127.0.0.1:5588/api/report-audio-comparison', {
		method: 'POST',
		headers
	});
	return POST({ request, url: new URL(request.url) } as Parameters<typeof POST>[0]);
}
test('paired audio uploads reject cross-origin, invalid content type and oversized requests', async () => {
	expect(
		(await attempt({ Origin: 'https://other.example', 'Content-Type': 'multipart/form-data' }))
			.status
	).toBe(403);
	expect(
		(await attempt({ Origin: 'http://127.0.0.1:5588', 'Content-Type': 'application/json' })).status
	).toBe(415);
	expect(
		(
			await attempt({
				Origin: 'http://127.0.0.1:5588',
				'Content-Type': 'multipart/form-data',
				'Content-Length': '101000001'
			})
		).status
	).toBe(413);
});
