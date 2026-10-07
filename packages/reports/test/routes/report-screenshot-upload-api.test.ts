import { expect, test, vi } from 'vitest';
import { POST } from '../../src/routes/api/report-screenshot-upload/+server';

test('upload endpoint rejects cross-origin requests before reading files', async () => {
	const request = new Request('http://127.0.0.1:5588/api/report-screenshot-upload', {
		method: 'POST',
		headers: { Origin: 'https://example.com', 'Content-Type': 'multipart/form-data' }
	});
	const response = await POST({ request, url: new URL(request.url) } as Parameters<typeof POST>[0]);
	expect(response.status).toBe(403);
});

test('upload endpoint reports missing R2 configuration clearly', async () => {
	for (const name of [
		'PROJECT_REPORTS_R2_ACCOUNT_ID',
		'PROJECT_REPORTS_R2_BUCKET',
		'PROJECT_REPORTS_R2_ACCESS_KEY_ID',
		'PROJECT_REPORTS_R2_SECRET_ACCESS_KEY'
	])
		vi.stubEnv(name, '');
	const body = new FormData();
	body.set('before', new File(['x'], 'before.png'));
	body.set('after', new File(['x'], 'after.png'));
	const request = new Request('http://127.0.0.1:5588/api/report-screenshot-upload', {
		method: 'POST',
		headers: { Origin: 'http://127.0.0.1:5588' },
		body
	});
	const response = await POST({ request, url: new URL(request.url) } as Parameters<typeof POST>[0]);
	expect(response.status).toBe(503);
	expect((await response.json()).error).toMatch(/not configured/);
	vi.unstubAllEnvs();
});
