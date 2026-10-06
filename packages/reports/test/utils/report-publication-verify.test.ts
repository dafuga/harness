import { expect, test, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { reportPublicationVerify } from '../../src/utils/reportPublicationVerify';
import type { PublicationBundle } from '../../src/utils/reportPublication';
const bytes = Buffer.from('original');
const bundle = {
	files: [
		{
			path: 'index.html',
			bytes,
			mime: 'text/html',
			sha256: createHash('sha256').update(bytes).digest('hex')
		}
	]
} as PublicationBundle;
test('publication proof verifies the actual HTTPS bytes and content type', async () => {
	const request = vi
		.fn()
		.mockResolvedValue(
			new Response(bytes, { headers: { 'Content-Type': 'text/html;charset=utf-8' } })
		);
	await reportPublicationVerify(bundle, 'https://abc.project-report-shares.pages.dev', request);
	expect(request.mock.calls[0][0].href).toBe('https://abc.project-report-shares.pages.dev/');
});
test('HTTP, missing files and mismatched bytes cannot satisfy publication proof', async () => {
	const request = vi
		.fn()
		.mockResolvedValue(new Response('different', { headers: { 'Content-Type': 'text/html' } }));
	await expect(
		reportPublicationVerify(bundle, 'http://abc.project-report-shares.pages.dev', request)
	).rejects.toThrow(/Invalid/);
	await expect(
		reportPublicationVerify(bundle, 'https://abc.project-report-shares.pages.dev', request)
	).rejects.toThrow(/digest differs/);
	request.mockResolvedValue(new Response('Missing', { status: 404 }));
	await expect(
		reportPublicationVerify(bundle, 'https://abc.project-report-shares.pages.dev', request)
	).rejects.toThrow(/unavailable/);
});
