import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { ScreenshotUploadService } from '../../src/routes/api/report-screenshot-upload/ScreenshotUploadService';
import { InvalidUploadInputError } from '../../src/routes/api/report-screenshot-upload/ScreenshotUploadService.types';
import type { ScreenshotUploadInput } from '../../src/routes/api/report-screenshot-upload/ScreenshotUploadService.types';

const screenshotBytes = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]);

function screenshot(name: string): File {
	return new File([screenshotBytes], name, { type: 'image/png' });
}

function uploadFixture(directory: string) {
	const stored: Array<{ reportId: string; name: string; mime: string }> = [];
	const report = { evidence: [] as Array<Record<string, unknown>>, updatedAt: '' };
	const repository = {
		mutateActive: async (
			_reportId: string,
			callback: (activeReport: typeof report, assetDirectory: string) => Promise<void>
		) => {
			await callback(report, directory);
			return report;
		}
	};
	const storage = {
		put: async (reportId: string, name: string, _bytes: Buffer, mime: string) => {
			stored.push({ reportId, name, mime });
		}
	};
	return { report, repository, storage, stored };
}

test('Uploads a desktop comparison', async () => {
	const directory = mkdtempSync(join(tmpdir(), 'screenshot-upload-'));
	try {
		const fixture = uploadFixture(directory);
		const input: ScreenshotUploadInput = {
			title: '  Checkout flow  ',
			viewport: 'desktop',
			before: screenshot('before.png'),
			after: screenshot('after.png')
		};
		const result = await new ScreenshotUploadService(fixture.repository as never, fixture.storage).upload(
			'report-123',
			input
		);
		expect(result).toBe(fixture.report);
		expect(fixture.stored).toHaveLength(2);
		expect(result.evidence).toHaveLength(2);
		const assetPaths = result.evidence.map((entry) => join(directory, 'assets', entry.file));
		expect(readFileSync(assetPaths[0]).length).toBe(screenshotBytes.length);
		recordExampleCases(
			{
				unitId: 'reports.service.screenshot-upload',
				symbol: 'upload',
				state: 'uploads-a-desktop-comparison',
				evidence: 'examples-cases',
				file: 'uploads-a-desktop-comparison.json'
			},
			[
				{
					name: 'stores both screenshots and returns the repository result',
					input: {
						reportId: 'report-123',
						title: input.title,
						viewport: input.viewport,
						before: input.before.name,
						after: input.after.name
					},
					output: {
						stored: fixture.stored,
						evidence: result.evidence.map(({ title, phase, viewport }) => ({ title, phase, viewport })),
						assetBytes: assetPaths.map((path) => readFileSync(path).length)
					}
				}
			]
		);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});

test('Rejects an empty comparison title', async () => {
	const input: ScreenshotUploadInput = {
		title: '   ',
		viewport: 'desktop',
		before: screenshot('before.png'),
		after: screenshot('after.png')
	};
	let error: unknown;
	try {
		await new ScreenshotUploadService({} as never, {} as never).upload('report-123', input);
	} catch (caught) {
		error = caught;
	}
	expect(error).toBeInstanceOf(InvalidUploadInputError);
	expect((error as Error).message).toBe('Comparison title must be 1–120 characters');
	recordExampleCases(
		{
			unitId: 'reports.service.screenshot-upload',
			symbol: 'upload',
			state: 'rejects-an-empty-comparison-title',
			evidence: 'examples-cases',
			file: 'rejects-an-empty-comparison-title.json'
		},
		[
			{
				name: 'rejects a title that is empty after trimming',
				input: { reportId: 'report-123', title: input.title, viewport: input.viewport },
				error: { name: (error as Error).name, message: (error as Error).message }
			}
		]
	);
});

test('Rejects an unsupported viewport', async () => {
	const input: ScreenshotUploadInput = {
		title: 'Checkout flow',
		viewport: 'wide',
		before: screenshot('before.png'),
		after: screenshot('after.png')
	};
	let error: unknown;
	try {
		await new ScreenshotUploadService({} as never, {} as never).upload('report-123', input);
	} catch (caught) {
		error = caught;
	}
	expect(error).toBeInstanceOf(InvalidUploadInputError);
	expect((error as Error).message).toBe('Invalid viewport');
	recordExampleCases(
		{
			unitId: 'reports.service.screenshot-upload',
			symbol: 'upload',
			state: 'rejects-an-unsupported-viewport',
			evidence: 'examples-cases',
			file: 'rejects-an-unsupported-viewport.json'
		},
		[
			{
				name: 'rejects a viewport outside the supported list',
				input: { reportId: 'report-123', title: input.title, viewport: input.viewport },
				error: { name: (error as Error).name, message: (error as Error).message }
			}
		]
	);
});
