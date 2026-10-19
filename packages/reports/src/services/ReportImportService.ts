import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { ReportRepository } from '../repositories/ReportRepository';
import { PlaywrightReportAdapter } from '../adapters/PlaywrightReportAdapter';
import { VitestReportAdapter } from '../adapters/VitestReportAdapter';
import { MiraReportAdapter } from '../adapters/MiraReportAdapter';
import type { RecordInput } from '../models/Report.types';
export class ReportImportService {
	constructor(private readonly repository = new ReportRepository()) {}
	async ingest(format: string, id: string, file: string, findings?: string) {
		if (format === 'playwright')
			return new PlaywrightReportAdapter().ingest(this.repository, id, file);
		if (format === 'vitest') return new VitestReportAdapter().ingest(this.repository, id, file);
		if (format === 'mira')
			return new MiraReportAdapter().ingest(this.repository, id, file, findings);
		const data = JSON.parse(await readFile(file, 'utf8')) as
			| RecordInput[]
			| Record<string, unknown>;
		if (format === 'manual') return this.manual(id, file, data);
		if (format === 'command') return this.command(id, data);
		throw new Error('Unsupported import format');
	}
	private async manual(id: string, file: string, data: RecordInput[] | Record<string, unknown>) {
		const records = Array.isArray(data) ? data : (data.records as RecordInput[]);
		if (!Array.isArray(records)) throw new Error('Manual import must contain records');
		for (const record of records) {
			if (record.kind === 'evidence' && typeof record.data.path === 'string') {
				record.data.path = resolve(dirname(file), record.data.path);
			}
			await this.repository.record(id, record);
		}
		return { records: records.length };
	}
	private async command(id: string, data: RecordInput[] | Record<string, unknown>) {
		if (Array.isArray(data)) throw new Error('Command outcome must be an object');
		const code = Number(data.exitCode);
		if (!Number.isInteger(code)) throw new Error('Command exitCode is required');
		const title = String(data.title || 'Command');
		await this.repository.record(id, {
			kind: 'check',
			data: {
				id: String(data.id || `command-${Date.now()}`),
				title,
				status: code === 0 ? 'passed' : 'failed',
				command: String(data.command || ''),
				output: String(data.output || ''),
				durationMs: Number(data.durationMs) || 0,
				group: 'Command'
			}
		});
		return { checks: 1 };
	}
}
