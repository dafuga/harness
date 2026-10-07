import { afterEach, expect, test, vi } from 'vitest';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ReportRepository } from '../../src/repositories/ReportRepository';
import { ScreenshotUploadService } from '../../src/services/ScreenshotUploadService';
import { ScreenshotRetentionService } from '../../src/services/ScreenshotRetentionService';
import { ReportExportService } from '../../src/services/ReportExportService';
import type { Report } from '../../src/models/Report.types';
import { reportProcess } from '../../src/utils/reportProcess';
import { reportPdf } from '../../src/utils/reportPdf';

const roots: string[] = [];
const oldImage = Buffer.from(
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lXcAAAAASUVORK5CYII=',
	'base64'
);
const newImage = Buffer.from(
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
	'base64'
);
async function setup(finalize: boolean) {
	const root = await mkdtemp(join(tmpdir(), 'report-retention-'));
	roots.push(root);
	const repository = new ReportRepository(root);
	const report = await repository.begin({
		project: '/tmp/app',
		title: 'Retention proof',
		mode: 'feature',
		environment: 'local'
	});
	const uploads = new ScreenshotUploadService(repository, {
		put: vi.fn().mockResolvedValue(undefined)
	});
	for (const [title, bytes] of [
		['Old', oldImage],
		['New', newImage]
	] as const) {
		await uploads.upload(report.id, {
			title,
			viewport: 'desktop',
			before: new File([bytes], 'before.png'),
			after: new File([bytes], 'after.png')
		});
	}
	const directory = repository.directory(report.id);
	const manifest = join(directory, 'manifest.json');
	const current = await repository.get(report.id);
	for (const item of current.evidence) {
		item.capturedAt = item.title.startsWith('Old')
			? '2026-08-20T12:00:00.000Z'
			: '2026-09-10T12:00:00.000Z';
	}
	await writeFile(manifest, JSON.stringify(current));
	if (finalize) await new ReportExportService(repository).finalize(report.id);
	return { repository, report, directory };
}
afterEach(async () => {
	await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});
async function entries(path: string): Promise<string[]> {
	const result = await reportProcess(reportPdf(), [
		'-c',
		'import json,sys,zipfile; print(json.dumps(zipfile.ZipFile(sys.argv[1]).namelist()))',
		path
	]);
	if (result.code) throw new Error(result.output);
	return JSON.parse(result.output);
}

test.each([false, true])(
	'30-day cleanup expires old uploads and preserves newer images; finalized=%s',
	async (finalize) => {
		const { repository, report, directory } = await setup(finalize);
		const before = await repository.get(report.id);
		const oldFile = before.evidence[0].file;
		const newFile = before.evidence[2].file;
		if (finalize) await writeFile(join(directory, 'exports', 'unrelated.txt'), 'keep this file');
		const service = new ScreenshotRetentionService(repository);
		const result = await service.run(new Date('2026-09-23T12:00:00.000Z'));
		expect(result.expired).toBe(2);
		const updated: Report = await repository.get(report.id);
		expect(
			updated.evidence.slice(0, 2).every((item) => item.missing && item.status === 'not-proven')
		).toBe(true);
		expect(updated.evidence[0].note).toMatch(/expired after 30 days/i);
		expect(updated.evidence.slice(2).every((item) => !item.missing)).toBe(true);
		await expect(stat(join(directory, 'assets', oldFile))).rejects.toMatchObject({
			code: 'ENOENT'
		});
		await expect(stat(join(directory, 'assets', newFile))).resolves.toBeDefined();
		expect((await service.run(new Date('2026-09-23T12:00:00.000Z'))).expired).toBe(0);
		if (finalize) {
			expect(await readFile(join(directory, 'exports', 'unrelated.txt'), 'utf8')).toBe(
				'keep this file'
			);
			const html = await readFile(join(directory, 'exports', 'index.html'), 'utf8');
			expect(html).not.toContain(oldImage.toString('base64'));
			expect(html).toContain(newImage.toString('base64'));
			const archive = await entries(join(directory, 'exports', 'report.zip'));
			expect(archive).not.toContain(`assets/${oldFile}`);
			expect(archive).toContain(`assets/${newFile}`);
		}
	}
);

test('a CLI capture sharing uploaded image bytes is retained', async () => {
	const { repository, report, directory } = await setup(false);
	const file = (await repository.get(report.id)).evidence[0].file;
	const source = join(directory, 'cli-capture.png');
	await writeFile(source, oldImage);
	await repository.record(report.id, {
		kind: 'evidence',
		data: { id: 'cli', title: 'CLI proof', category: 'Existing', path: source, status: 'passed' }
	});
	await new ScreenshotRetentionService(repository).run(new Date('2026-09-23T12:00:00.000Z'));
	const updated = await repository.get(report.id);
	expect(updated.evidence[0].missing).toBe(true);
	expect(updated.evidence.at(-1)?.missing).not.toBe(true);
	await expect(stat(join(directory, 'assets', file))).resolves.toBeDefined();
});

test('one cleanup covers uploaded screenshots from every project in the hub', async () => {
	const root = await mkdtemp(join(tmpdir(), 'report-retention-projects-'));
	roots.push(root);
	const repository = new ReportRepository(root);
	const ids: string[] = [];
	for (const project of ['/tmp/project-alpha', '/tmp/project-beta']) {
		const report = await repository.begin({
			project,
			title: 'Cross-project upload',
			mode: 'feature',
			environment: 'local'
		});
		ids.push(report.id);
		await new ScreenshotUploadService(repository, {
			put: vi.fn().mockResolvedValue(undefined)
		}).upload(report.id, {
			title: 'Old pair',
			viewport: 'desktop',
			before: new File([oldImage], 'before.png'),
			after: new File([oldImage], 'after.png')
		});
		const current = await repository.get(report.id);
		for (const item of current.evidence) item.capturedAt = '2026-08-20T12:00:00.000Z';
		await writeFile(
			join(repository.directory(report.id), 'manifest.json'),
			JSON.stringify(current)
		);
	}
	const result = await new ScreenshotRetentionService(repository).run(
		new Date('2026-09-23T12:00:00.000Z')
	);
	expect(result).toEqual({ expired: 4, reports: 2 });
	for (const id of ids) {
		const report = await repository.get(id);
		expect(report.evidence.every((item) => item.missing)).toBe(true);
	}
});
