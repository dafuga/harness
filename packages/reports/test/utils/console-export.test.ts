import { expect, test } from 'vitest';
import { consoleExport } from '../../src/utils/console-server/consoleExport';

const commit = 'a'.repeat(40);
const older = 'b'.repeat(40);
const media = `${'c'.repeat(64)}.png`;
const capture = (status: string, revision: string) => ({
	evidence: 'screens',
	kind: 'screenshot',
	state: 'empty',
	viewport: 'desktop',
	status,
	path: 'evidence/empty-desktop.png',
	sha256: 'c'.repeat(64),
	mediaType: 'image/png',
	capturedAt: '2026-10-10T18:00:00.000Z',
	server: { buildId: 'build-7', revision },
	media: `media/${media}`
});
const record = (id: string, status: string, shot: object) => ({
	id,
	status,
	valid: true,
	problems: [],
	source: { commit, base: null },
	profile: 'p1',
	startedAt: '2026-10-10T18:00:00.000Z',
	finishedAt: '2026-10-10T18:00:01.000Z',
	failures: status === 'failed' ? ['titles-page: stale build'] : [],
	tests: [],
	scenarios: [
		{
			id: 'titles-page',
			status,
			testedRevision: commit,
			inherited: false,
			origin: { record: id, commit },
			states: [{ id: 'empty', coverage: 'required', captures: [shot] }]
		}
	],
	measurements: [],
	budgets: { findings: [] }
});
const index = JSON.stringify({ revisions: [{ commit, subject: 'feat: titles' }] });
const detail = JSON.stringify({
	commit,
	registry: { scenarios: [] },
	records: [
		record('1'.repeat(64), 'failed', capture('failed', older)),
		record('2'.repeat(64), 'passed', capture('passed', commit))
	]
});
const assets = { script: 'window.viewer=1;', style: 'body{}' };
const png = new Uint8Array(70_000).fill(7);
const input = (asked: string | null, at = commit) => ({
	commit: at,
	record: asked,
	index,
	detail,
	media: (name: string) =>
		Promise.resolve(name === media ? { bytes: png, type: 'image/png' } : undefined)
});
const reportOf = (html: string) =>
	JSON.parse(/window\.projectReport=(.*?);<\/script>/.exec(html)?.[1] ?? '{}') as {
		status: string;
		evidence: Array<{ file: string; standing: string; missing?: boolean }>;
	};

test('the export of a commit is its passing record, with media inlined byte for byte', async () => {
	const html = (await consoleExport(input(null), assets)) ?? '';
	expect(html.startsWith('<!doctype html>')).toBe(true);
	expect(html).toContain('<script>window.viewer=1;</script>');
	const report = reportOf(html);
	expect(report.status).toBe('passed');
	expect(report.evidence).toHaveLength(1);
	const [, encoded] = report.evidence[0].file.split('base64,');
	expect(Buffer.from(encoded, 'base64')).toEqual(Buffer.from(png));
	expect(report.evidence[0].standing).toBe('Fresh capture');
});

test('a named record is exported as recorded, and what is absent stays absent', async () => {
	const failed = reportOf((await consoleExport(input('1'.repeat(64)), assets)) ?? '');
	expect([failed.status, failed.evidence[0].standing]).toEqual([
		'failed',
		'Rejected capture from another revision'
	]);
	expect(await consoleExport(input(null, older), assets)).toBeUndefined();
	const gone = { ...input(null), media: () => Promise.resolve(undefined) };
	expect(reportOf((await consoleExport(gone, assets)) ?? '').evidence[0].missing).toBe(true);
});
