import { readFile } from 'node:fs/promises';
import type { ReportRepository } from '../repositories/ReportRepository';
import type { Status } from '../models/Report.types';
type VitestCase = { fullName?: string; title?: string; status?: string; duration?: number };
type VitestFile = { name?: string; assertionResults?: VitestCase[] };
type VitestData = {
	testResults?: VitestFile[];
	numPassedTests?: number;
	numFailedTests?: number;
	numPendingTests?: number;
};
export class VitestReportAdapter {
	async ingest(store: ReportRepository, id: string, file: string) {
		const data = JSON.parse(await readFile(file, 'utf8')) as VitestData;
		let index = 0;
		for (const result of data.testResults || []) {
			for (const test of result.assertionResults || [])
				await this.record({ store, id, result }, test, ++index);
		}
		if (!index) await this.summary(store, id, data);
		return { checks: index };
	}
	private async record(
		context: { store: ReportRepository; id: string; result: VitestFile },
		test: VitestCase,
		index: number
	) {
		await context.store.record(context.id, {
			kind: 'check',
			data: {
				id: `vitest-${index}`,
				title: test.fullName || test.title || 'Unnamed test',
				status: this.status(test.status),
				group: context.result.name || 'Vitest',
				durationMs: test.duration
			}
		});
	}
	private async summary(store: ReportRepository, id: string, data: VitestData) {
		await store.record(id, {
			kind: 'check',
			data: {
				id: 'vitest-summary',
				title: 'Vitest results',
				status: 'not-proven',
				counts: {
					passed: data.numPassedTests || 0,
					failed: data.numFailedTests || 0,
					skipped: data.numPendingTests || 0
				},
				group: 'Vitest - no individual test results supplied'
			}
		});
	}
	private status(value?: string): Status {
		if (value === 'passed') return 'passed';
		if (value === 'failed') return 'failed';
		if (value === 'pending' || value === 'skipped' || value === 'todo') return 'skipped';
		return 'not-proven';
	}
}
