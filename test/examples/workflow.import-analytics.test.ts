import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, vi } from 'vitest';
import { importAnalytics } from '../../src/workflows/reports-media/importAnalytics';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir } from '../support/temporary';
import { expect } from '../verificationExpect';

const repository = vi.hoisted(() => ({
	reconcileHistorical: vi.fn(),
	recordImported: vi.fn((event: { kind: string; action: string; historical?: boolean }) => {
		void event;
	}),
	close: vi.fn()
}));

vi.mock('../../src/repositories/reports-media/AnalyticsRepository', () => ({
	AnalyticsRepository: { open: vi.fn(async () => repository) }
}));

function writeLoop(root: string): void {
	const loop = join(root, 'specification', 'loops', 'release-check');
	mkdirSync(loop, { recursive: true });
	writeFileSync(
		join(loop, 'loop.json'),
		JSON.stringify({
			name: 'Release check',
			goal: 'Verify the release',
			createdAt: '2026-01-02T03:04:05.000Z',
			updatedAt: '2026-01-02T03:05:05.000Z',
			template: 'release',
			agentModel: 'example-model',
			steps: [{ id: 'verify', status: 'complete', completedAt: '2026-01-02T03:05:00.000Z' }]
		})
	);
	writeFileSync(
		join(loop, 'trace.ndjson'),
		JSON.stringify({
			event: 'loop.evaluated',
			timestamp: '2026-01-02T03:05:02.000Z',
			passed: true,
			durationMs: 1200
		})
	);
}

test('Imports loop events and marks them non-historical', async () => {
	await withTempDir('import-analytics-', async (directory) => {
		const root = join(directory, 'project');
		writeLoop(root);
		repository.reconcileHistorical.mockClear();
		repository.recordImported.mockClear();
		repository.close.mockClear();
		const output = await importAnalytics(root, false);
		const imported = repository.recordImported.mock.calls.map(([event]) => event);
		expect(output).toBe(4);
		expect(imported).toHaveLength(4);
		expect(imported.every((event) => event.historical === false)).toBe(true);
		expect(repository.close).toHaveBeenCalledOnce();
		recordExampleCases(
			{
				unitId: 'workflow.import-analytics',
				symbol: 'importAnalytics',
				state: 'imports-loop-events-and-marks-them-non-historical',
				evidence: 'examples-cases',
				file: 'imports-loop-events-and-marks-them-non-historical.json'
			},
			[
				{
					name: 'imports creation, completed step and loop, plus one evaluation',
					input: { root: '<temporary>/project', historical: false },
					output: {
						count: output,
						events: imported.map(({ kind, action, historical }) => ({ kind, action, historical }))
					}
				}
			]
		);
	});
});

test('Throws Error when history reconciliation fails', async () => {
	await withTempDir('import-analytics-error-', async (directory) => {
		const root = join(directory, 'project');
		writeLoop(root);
		repository.reconcileHistorical.mockRejectedValueOnce(new Error('history unavailable'));
		repository.close.mockClear();
		await expect(importAnalytics(root, false)).rejects.toThrow('history unavailable');
		expect(repository.close).toHaveBeenCalledOnce();
		recordExampleCases(
			{
				unitId: 'workflow.import-analytics',
				symbol: 'importAnalytics',
				state: 'throws-error-when-history-reconciliation-fails',
				evidence: 'examples-cases',
				file: 'throws-error-when-history-reconciliation-fails.json'
			},
			[
				{
					name: 'rejects when historical analytics cannot be reconciled',
					input: { root: '<temporary>/project', historical: false },
					error: { name: 'Error', message: 'history unavailable' }
				}
			]
		);
	});
});
