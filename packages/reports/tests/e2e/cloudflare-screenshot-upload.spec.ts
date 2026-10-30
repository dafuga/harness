import type { Upload } from './cloudflare-screenshot-upload.spec.types';
import { expect, test, type APIRequestContext } from '../../../../test/support/browserTest';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ReportRepository } from '../../src/repositories/report-repository/ReportRepository';
import { ScreenshotRetentionService } from '../../src/services/ScreenshotRetentionService';
import { fixtures, seededId } from './support/fixtures';
import { expectRetired } from './support/retiredAddress';

/**
 * Posts a before/after pair to the upload service, as the removed form of the report page did.
 * The pair goes to the object store of the run, so the viewer reads it back through the API.
 */
/** An active report of the hosting application, so that a run that is repeated starts clean. */
async function begun(title: string): Promise<string> {
	const repository = new ReportRepository(fixtures.reports);
	const report = await repository.begin({
		project: fixtures.site('alpha-project'),
		title,
		mode: 'feature',
		environment: 'local fixture'
	});
	return report.id;
}

async function upload(request: APIRequestContext, origin: string, fields: Upload) {
	const image = await readFile(join(fixtures.reports, 'fixture.png'));
	const file = (name: string) => ({ name, mimeType: 'image/png', buffer: image });
	const response = await request.post('/api/report-screenshot-upload', {
		headers: { Origin: origin },
		multipart: { ...fields, before: file('before.png'), after: file('after.png') }
	});
	expect(response.status()).toBe(201);
	return response.json();
}

test('the upload service adds a before/after pair and serves its images', async ({
	page,
	request,
	baseURL
}) => {
	const id = await begun('Upload review');
	await expectRetired(page, `/reports/${id}`);
	await expect(page.getByText('Add before/after comparison', { exact: true })).toHaveCount(0);
	const fields = { reportId: id, title: 'Uploaded checkout flow', viewport: 'desktop' };
	const report = await upload(request, baseURL!, fields);
	const added = report.evidence.filter((item: { title: string }) =>
		item.title.startsWith('Uploaded checkout flow')
	);
	expect(added.map((item: { phase: string }) => item.phase)).toEqual(['before', 'after']);
	// Both pictures are the bytes the object store kept, read back through the report API.
	const image = await readFile(join(fixtures.reports, 'fixture.png'));
	for (const item of added as Array<{ file: string }>) {
		const served = await request.get(`/api/reports/${id}/assets/${item.file}`);
		expect([served.status(), (await served.body()).equals(image)]).toEqual([200, true]);
	}
});

test('a pair without a title or a known screen size is refused', async ({ request, baseURL }) => {
	const id = await begun('Mobile upload review');
	// A pair without a title or without a known screen size is refused, and adds nothing.
	const refused = await request.post('/api/report-screenshot-upload', {
		headers: { Origin: baseURL! },
		multipart: { reportId: id, title: '', viewport: 'mobile' }
	});
	expect(refused.status()).toBe(400);
});

test('multipart upload accepts realistic screenshots above the default body limit', async ({
	request,
	baseURL
}) => {
	const id = await seededId();
	const image = await readFile(join(fixtures.reports, 'large.png'));
	expect(image.length).toBeGreaterThan(512_000);
	const response = await request.post('/api/report-screenshot-upload', {
		headers: { Origin: baseURL! },
		multipart: {
			reportId: id,
			title: 'Large image proof',
			viewport: 'desktop',
			before: { name: 'before.png', mimeType: 'image/png', buffer: image },
			after: { name: 'after.png', mimeType: 'image/png', buffer: image }
		}
	});
	expect(response.status()).toBe(201);
	const report = await response.json();
	const asset = report.evidence.find(
		(item: { title: string }) => item.title === 'Large image proof after'
	);
	const served = await request.get(`/api/reports/${id}/assets/${asset.file}`);
	expect(served.status()).toBe(200);
	expect((await served.body()).length).toBe(image.length);
});

test('expired uploads stay in the report without downloadable image bytes', async ({
	request,
	baseURL
}) => {
	const repository = new ReportRepository(fixtures.reports);
	const report = await repository.begin({
		project: fixtures.site('alpha-project'),
		title: 'Retention review',
		mode: 'feature',
		environment: 'local fixture'
	});
	await upload(request, baseURL!, {
		reportId: report.id,
		title: 'Retention proof',
		viewport: 'desktop'
	});
	const manifest = repository.directory(report.id) + '/manifest.json';
	const stored = await repository.get(report.id);
	const file = stored.evidence[1].file;
	for (const item of stored.evidence)
		item.capturedAt = new Date(Date.now() - 31 * 86_400_000).toISOString();
	await writeFile(manifest, JSON.stringify(stored));
	const cleanup = await new ScreenshotRetentionService(repository).run();
	expect(cleanup.expired).toBe(2);
	const after = await repository.get(report.id);
	expect(after.evidence.every((item) => item.missing)).toBe(true);
	expect(after.evidence[1].note).toContain('Screenshot expired after 30 days');
	expect((await request.get(`/api/reports/${report.id}/assets/${file}`)).status()).toBe(410);
});
