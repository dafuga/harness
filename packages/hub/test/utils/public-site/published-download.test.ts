import { expect, test, vi } from 'vitest';
import { publishedDownload } from '../../../src/utils/public-site/publishedDownload';

const path = '/downloads/Harness-mac-arm64.zip';
const zip = 'application/zip';
const answer = (status: number, type?: string) =>
	vi.fn<typeof fetch>(
		async () => new Response(null, { status, headers: type ? { 'content-type': type } : {} })
	);

test('a same-origin HEAD that answers 200 as a zip publishes the link', async () => {
	const request = answer(200, 'application/zip');
	expect(await publishedDownload(path, zip, request)).toBe(path);
	expect(request).toHaveBeenCalledWith(path, {
		method: 'HEAD',
		cache: 'no-store',
		credentials: 'omit',
		redirect: 'error'
	});
});

test('media type parameters and letter case do not hide a zip', async () => {
	expect(await publishedDownload(path, zip, answer(200, 'Application/Zip; charset=binary'))).toBe(
		path
	);
});

test.each([
	['a missing archive', answer(404, 'text/html')],
	['a page served in its place', answer(200, 'text/html')],
	['no media type', answer(200)],
	['a server error', answer(503, zip)],
	['a partial answer', answer(206, zip)]
])('%s keeps the download pending', async (_name, request) => {
	expect(await publishedDownload(path, zip, request)).toBeNull();
});

test('a redirect or an unreachable Hub keeps the download pending', async () => {
	const refused = vi.fn<typeof fetch>(async () => {
		throw new TypeError('Failed to fetch');
	});
	expect(await publishedDownload(path, zip, refused)).toBeNull();
});

test('only a same-origin path is ever asked for', async () => {
	for (const other of ['https://example.invalid/Harness.zip', '//example.invalid/Harness.zip']) {
		const request = answer(200, zip);
		expect(await publishedDownload(other, zip, request)).toBeNull();
		expect(request).not.toHaveBeenCalled();
	}
});
