import type {
	Report,
	RecordInput,
	Check,
	Evidence,
	Finding,
	Coverage
} from '../models/Report.types';
import { cleanData } from './sanitize';
import { reportAssets } from './reportAssets';
function upsert<T extends { id: string }>(items: T[], value: T) {
	return [...items.filter((item) => item.id !== value.id), value];
}
export async function reportIngest(report: Report, record: RecordInput, directory: string) {
	const data = cleanData(record.data);
	if (record.kind === 'summary') report.summary = String(data.text);
	if (record.kind === 'acceptance') report.acceptance = data.items as string[];
	if (record.kind === 'check') report.checks = upsert(report.checks, data as unknown as Check);
	if (record.kind === 'finding')
		report.findings = upsert(report.findings, data as unknown as Finding);
	if (record.kind === 'coverage')
		report.coverage = upsert(report.coverage, data as unknown as Coverage);
	if (record.kind === 'evidence') {
		const { path: _path, storage: _storage, ...details } = data;
		const { name: file, ...metadata } = await reportAssets(directory, String(record.data.path));
		const evidence = {
			...details,
			...metadata,
			file,
			category: data.category || 'Evidence',
			status: data.status || 'not-proven'
		} as unknown as Evidence;
		report.evidence = upsert(report.evidence, evidence);
	}
	report.updatedAt = new Date().toISOString();
	return report;
}
