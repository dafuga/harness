import { dirname, resolve, extname } from 'node:path';
import { readFile } from 'node:fs/promises';
import type { ReportRepository } from '../repositories/ReportRepository';
import type { Status } from '../models/Report.types';
type PwResult = {
	status?: string;
	duration?: number;
	attachments?: { name: string; path?: string }[];
};
type PwTest = { status?: string; results?: PwResult[] };
type PwSpec = { title?: string; tests?: PwTest[] };
type PwSuite = { specs?: PwSpec[]; suites?: PwSuite[] };
type Context = { store: ReportRepository; id: string; file: string };
type Meta = { status: Status; checkId: string; index: number; result?: PwResult };
function collect(suites: PwSuite[]): PwSpec[] {
	return suites.flatMap((suite) => [...(suite.specs || []), ...collect(suite.suites || [])]);
}
export class PlaywrightReportAdapter {
	async ingest(store: ReportRepository, id: string, file: string) {
		const data = JSON.parse(await readFile(file, 'utf8')) as { suites?: PwSuite[] };
		let index = 0;
		for (const spec of collect(data.suites || []))
			if (spec.tests?.length) await this.record({ store, id, file }, spec, ++index);
		return { checks: index };
	}
	private async record(context: Context, spec: PwSpec, index: number) {
		const test = spec.tests![0],
			result = test.results?.at(-1);
		const meta = {
			status: this.status(test.status, result?.status),
			checkId: `pw-${index}`,
			index,
			result
		};
		await context.store.record(context.id, {
			kind: 'check',
			data: {
				id: meta.checkId,
				title: spec.title || meta.checkId,
				status: meta.status,
				durationMs: result?.duration,
				group: 'Playwright'
			}
		});
		await this.attachments(context, spec, meta);
	}
	private async attachments(context: Context, spec: PwSpec, meta: Meta) {
		for (const [number, attachment] of (meta.result?.attachments || []).entries()) {
			if (
				!attachment.path ||
				!['.png', '.jpg', '.jpeg', '.webp'].includes(extname(attachment.path).toLowerCase())
			)
				continue;
			await context.store.record(context.id, {
				kind: 'evidence',
				data: {
					id: `${meta.checkId}-${number}`,
					title: `${spec.title || meta.checkId} - ${attachment.name}`,
					category: 'Playwright',
					status: meta.status,
					path: resolve(dirname(context.file), attachment.path),
					checkId: meta.checkId,
					order: meta.index
				}
			});
		}
	}
	private status(test?: string, result?: string): Status {
		if (test === 'skipped' || result === 'skipped') return 'skipped';
		if (test === 'expected' || result === 'passed') return 'passed';
		if (test === 'unexpected' || result === 'failed' || result === 'timedOut') return 'failed';
		if (result === 'interrupted') return 'interrupted';
		return 'not-proven';
	}
}
