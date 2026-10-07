import { afterEach, expect, test, vi } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ReportRepository } from '../../src/repositories/ReportRepository';
import { ScreenshotUploadService } from '../../src/services/ScreenshotUploadService';

const roots: string[] = [];
const png = Buffer.from(
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lXcAAAAASUVORK5CYII=',
	'base64'
);
async function fixture() {
	const root = await mkdtemp(join(tmpdir(), 'report-upload-'));
	roots.push(root);
	const repository = new ReportRepository(root);
	const report = await repository.begin({
		project: '/tmp/app',
		title: 'Review',
		mode: 'feature',
		environment: 'local'
	});
	const put = vi.fn().mockResolvedValue(undefined);
	const service = new ScreenshotUploadService(repository, { put });
	const input = {
		title: 'Checkout',
		viewport: 'desktop',
		before: new File([png], 'before.png', { type: 'image/png' }),
		after: new File([png], 'after.png', { type: 'image/png' })
	};
	return { repository, report, put, service, input };
}
afterEach(async () => {
	await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

test('one upload records a matched pair only after both R2 writes succeed', async () => {
	const { repository, report, put, service, input } = await fixture();
	const updated = await service.upload(report.id, input);
	expect(put).toHaveBeenCalledTimes(2);
	expect(updated.evidence.map((item) => item.phase)).toEqual(['before', 'after']);
	expect(new Set(updated.evidence.map((item) => item.comparison)).size).toBe(1);
	expect(
		updated.evidence.every((item) => item.storage === 'r2' && item.status === 'not-proven')
	).toBe(true);
	expect((await repository.get(report.id)).evidence).toHaveLength(2);
});

test('invalid images, R2 failures, and finalized reports create no evidence', async () => {
	const { repository, report, put, service, input } = await fixture();
	await expect(
		service.upload(report.id, { ...input, before: new File(['bad'], 'bad.png') })
	).rejects.toThrow(/PNG|image/i);
	expect(put).not.toHaveBeenCalled();
	put.mockRejectedValueOnce(new Error('R2 unavailable'));
	await expect(service.upload(report.id, input)).rejects.toThrow('R2 unavailable');
	expect((await repository.get(report.id)).evidence).toHaveLength(0);
	await repository.seal(report.id);
	await expect(service.upload(report.id, input)).rejects.toThrow(/finaliz/);
	expect((await repository.get(report.id)).evidence).toHaveLength(0);
});
