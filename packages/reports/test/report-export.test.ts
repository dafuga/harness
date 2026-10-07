import { afterEach, expect, test } from 'vitest';
import { mkdtemp, readFile, rm, writeFile, mkdir, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ReportRepository } from '../src/repositories/ReportRepository';
import { ReportExportService } from '../src/services/ReportExportService';
import { reportProcess } from '../src/utils/reportProcess';
import { reportPdf } from '../src/utils/reportPdf';
const roots: string[] = [];
const pixel =
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
async function fixture() {
	const root = await mkdtemp(join(tmpdir(), 'report-export-'));
	roots.push(root);
	const source = join(root, 'capture.png');
	await writeFile(source, Buffer.from(pixel, 'base64'));
	const store = new ReportRepository(root);
	const run = await store.begin({
		project: '/tmp/verified-project',
		title: 'Export proof',
		mode: 'feature',
		environment: 'local',
		revision: 'test-revision',
		summary: 'A report with a readable capture.'
	});
	await store.record(run.id, {
		kind: 'check',
		data: { id: 'proof', title: 'Browser assertion', status: 'passed' }
	});
	await store.record(run.id, {
		kind: 'evidence',
		data: {
			id: 'capture',
			title: 'Proof capture',
			category: 'Flow',
			path: source,
			status: 'passed',
			viewport: '390px mobile',
			order: 1
		}
	});
	return { root, store, run };
}
afterEach(async () => {
	await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});
async function archiveEntries(path: string) {
	const python =
		'import json,sys,zipfile; print(json.dumps(zipfile.ZipFile(sys.argv[1]).namelist()))';
	const result = await reportProcess(reportPdf(), ['-c', python, path]);
	if (result.code) throw new Error(result.output);
	return JSON.parse(result.output) as string[];
}
test('finalization emits portable gallery, readable PDF, and only registered ZIP assets', async () => {
	const { root, store, run } = await fixture();
	const directory = store.directory(run.id);
	await writeFile(join(directory, 'private.txt'), 'DO-NOT-EXPORT');
	await mkdir(join(directory, 'assets'), { recursive: true });
	await writeFile(join(directory, 'assets', 'stray.png'), Buffer.from(pixel, 'base64'));
	const final = await new ReportExportService(store).finalize(run.id);
	expect(final.state).toBe('finalized');
	expect(final.status).toBe('passed');
	const html = await readFile(join(directory, 'exports', 'index.html'), 'utf8');
	expect(html).toContain('data:image/png;base64,');
	expect(html).toContain('Proof capture');
	expect(html).not.toContain('DO-NOT-EXPORT');
	const pdf = await readFile(join(directory, 'exports', 'report.pdf'));
	expect(pdf.subarray(0, 4).toString()).toBe('%PDF');
	const entries = await archiveEntries(join(directory, 'exports', 'report.zip'));
	expect(entries).toContain('index.html');
	expect(entries).toContain('report.pdf');
	expect(entries).toContain('manifest.json');
	expect(entries.some((name) => name.startsWith('assets/'))).toBe(true);
	expect(entries).not.toContain('assets/stray.png');
	expect(entries).not.toContain('private.txt');
	await expect(
		store.record(run.id, { kind: 'summary', data: { text: 'changed' } })
	).rejects.toThrow(/final/);
	expect(root).toBeTruthy();
});
test('missing copied screenshots are visibly not proven in finalized exports', async () => {
	const { store, run } = await fixture();
	const directory = store.directory(run.id);
	await unlink(join(directory, 'assets', (await store.get(run.id)).evidence[0].file));
	const final = await new ReportExportService(store).finalize(run.id);
	expect(final.status).toBe('blocked');
	expect(final.evidence[0].status).toBe('not-proven');
	const entries = await archiveEntries(join(directory, 'exports', 'report.zip'));
	expect(entries.some((name) => name.startsWith('assets/'))).toBe(false);
	expect(await readFile(join(directory, 'exports', 'index.html'), 'utf8')).toContain(
		'Image unavailable'
	);
});
