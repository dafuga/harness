import { afterEach, test, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Report } from '../../src/models/reports-media/Report.types';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { reportHttp } from '../../src/routes/api/health/reportHttp';
import { reportFile } from '../../src/routes/api/reports/[id]/[type]/[file]/reportHttp';
import { repository } from '../../src/utils/reports-media/reportHttp';

vi.mock('../../src/adapters/R2EvidenceStoreAdapter', () => ({
	R2EvidenceStoreAdapter: { fromEnvironment: () => null }
}));

vi.mock('../../src/adapters/reports-media/R2ScreenshotStoreAdapter', () => ({
	R2ScreenshotStoreAdapter: {
		fromEnvironment: () => ({ get: async () => new TextEncoder().encode('remote-png') })
	}
}));

const UNIT = 'reports.function.report-http';
const REPORT_ID = '3f6c9a2e-8b1d-4e7a-9c05-2d4b6f1a8e90';

type Failure = { status: number | null; message: string };

const tempDirs: string[] = [];

afterEach(() => {
	vi.restoreAllMocks();
	for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function meta(symbol: string, state: string) {
	return { unitId: UNIT, symbol, state, evidence: 'examples-cases', file: `${state}.json` };
}

function tempReportDir(): string {
	const dir = mkdtempSync(join(tmpdir(), 'reports-http-'));
	tempDirs.push(dir);
	return dir;
}

function serveReport(dir: string, evidence: unknown[]) {
	const report = { id: REPORT_ID, evidence } as unknown as Report;
	vi.spyOn(repository, 'get').mockResolvedValue(report);
	vi.spyOn(repository, 'directory').mockReturnValue(dir);
}

async function rejection(work: () => Promise<unknown>): Promise<Failure> {
	try {
		await work();
	} catch (thrown) {
		const failure = thrown as { status?: number; body?: { message?: string }; message?: string };
		return {
			status: failure.status ?? null,
			message: failure.body?.message ?? failure.message ?? ''
		};
	}
	throw new Error('Expected the request to be rejected');
}

test('Serves a registered local asset with its media type', async () => {
	const dir = tempReportDir();
	mkdirSync(join(dir, 'assets'), { recursive: true });
	writeFileSync(join(dir, 'assets', 'homepage.png'), 'fixture-png');
	serveReport(dir, [{ file: 'homepage.png' }]);

	const response = await reportFile(REPORT_ID, 'assets', 'homepage.png');
	const body = await response.text();

	expect(response.status).toBe(200);
	expect(response.headers.get('content-type')).toMatch(/image\/png/);
	expect(body).toBe('fixture-png');
	recordExampleCases(meta('reportFile', 'serves-a-registered-local-asset-with-its-media-type'), [
		{
			name: 'local homepage screenshot is read from the report assets folder',
			input: { id: REPORT_ID, type: 'assets', file: 'homepage.png' },
			output: { status: response.status, body }
		}
	]);
});

test('Rejects an evidence file that is missing or unknown', async () => {
	serveReport(tempReportDir(), [{ file: 'checkout-error.png', missing: true }]);

	const expired = await rejection(() => reportFile(REPORT_ID, 'assets', 'checkout-error.png'));
	const unknown = await rejection(() => reportFile(REPORT_ID, 'assets', 'login-screen.png'));

	expect(expired).toEqual({ status: 410, message: 'Evidence expired or unavailable' });
	expect(unknown).toEqual({ status: 404, message: 'Evidence expired or unavailable' });
	recordExampleCases(meta('reportFile', 'rejects-an-evidence-file-that-is-missing-or-unknown'), [
		{
			name: 'evidence exists but every entry is missing',
			input: { id: REPORT_ID, type: 'assets', file: 'checkout-error.png' },
			error: expired
		},
		{
			name: 'no evidence entry has the requested file name',
			input: { id: REPORT_ID, type: 'assets', file: 'login-screen.png' },
			error: unknown
		}
	]);
});

test('Rejects any evidence type other than assets', async () => {
	serveReport(tempReportDir(), [{ file: 'homepage.png' }]);

	const exports = await rejection(() => reportFile(REPORT_ID, 'exports', 'homepage.png'));

	expect(exports).toEqual({ status: 404, message: 'Not found' });
	recordExampleCases(meta('reportFile', 'rejects-any-evidence-type-other-than-assets'), [
		{
			name: 'exports type is refused before any file is read',
			input: { id: REPORT_ID, type: 'exports', file: 'homepage.png' },
			error: exports
		}
	]);
});

test('Fails remote evidence when R2 storage is not configured', async () => {
	serveReport(tempReportDir(), [{ file: 'homepage.png', storage: 'r2-evidence' }]);

	const failure = await rejection(() => reportFile(REPORT_ID, 'assets', 'homepage.png'));

	expect(failure).toEqual({
		status: null,
		message: 'Cloudflare R2 evidence storage is not configured'
	});
	recordExampleCases(meta('reportFile', 'fails-remote-evidence-when-r2-storage-is-not-configured'), [
		{
			name: 'r2-evidence file with no evidence store configured',
			input: { id: REPORT_ID, type: 'assets', file: 'homepage.png', storage: 'r2-evidence' },
			error: failure
		}
	]);
});

test('Serves remote screenshots from R2 with their media type', async () => {
	serveReport(tempReportDir(), [{ file: 'checkout-error.png', storage: 'r2' }]);

	const response = await reportFile(REPORT_ID, 'assets', 'checkout-error.png');
	const body = await response.text();

	expect(response.status).toBe(200);
	expect(body).toBe('remote-png');
	recordExampleCases(meta('reportFile', 'serves-remote-screenshots-from-r2-with-their-media-type'), [
		{
			name: 'remote screenshot fetched from the screenshot store',
			input: { id: REPORT_ID, type: 'assets', file: 'checkout-error.png', storage: 'r2' },
			output: { status: response.status, body }
		}
	]);
});

test('Describes the server by a digest of its repository root', async () => {
	const response = reportHttp();
	const body = (await response.json()) as Record<string, unknown>;

	expect(response.status).toBe(200);
	expect(body.app).toBe('project-reports');
	expect(body.version).toBe(1);
	expect(body.root).toBe(createHash('sha256').update(repository.root).digest('hex'));
	recordExampleCases(meta('reportHttp', 'describes-the-server-by-a-digest-of-its-repository-root'), [
		{
			name: 'health endpoint reports app, version and a root digest',
			input: {},
			output: {
				status: response.status,
				app: body.app,
				version: body.version,
				rootIsSha256Hex: /^[0-9a-f]{64}$/.test(String(body.root))
			}
		}
	]);
});
