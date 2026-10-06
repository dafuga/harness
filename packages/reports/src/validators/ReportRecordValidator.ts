import type { RecordInput } from '../models/Report.types';
import { safeId } from '../utils/reportFiles';
const kinds = new Set([
	'check',
	'evidence',
	'finding',
	'coverage',
	'acceptance',
	'summary',
	'heartbeat'
]);
const statuses = new Set([
	'running',
	'passed',
	'failed',
	'blocked',
	'skipped',
	'not-proven',
	'interrupted'
]);
export class ReportRecordValidator {
	static validate(record: RecordInput) {
		if (!record || !kinds.has(record.kind)) throw new Error('Unsupported record kind');
		if (!record.data || typeof record.data !== 'object' || Array.isArray(record.data))
			throw new Error('Record data is required');
		if (record.kind === 'heartbeat') return;
		if (record.kind === 'summary') {
			if (typeof record.data.text !== 'string') throw new Error('Summary text is required');
			return;
		}
		if (record.kind === 'acceptance') {
			this.acceptance(record.data);
			return;
		}
		this.item(record);
	}
	private static acceptance(data: Record<string, unknown>) {
		const items = data.items;
		if (
			!Array.isArray(items) ||
			items.length > 30 ||
			items.some((item) => typeof item !== 'string' || !item.trim() || item.length > 500)
		)
			throw new Error('Acceptance criteria must be a list of short nonempty strings');
	}
	private static item(record: RecordInput) {
		const data = record.data;
		safeId(String(data.id || ''));
		if (typeof data.title !== 'string' || !data.title.trim() || data.title.length > 500)
			throw new Error('Record title is required');
		if (record.kind === 'evidence') this.evidence(data);
		if (record.kind !== 'evidence' && !statuses.has(String(data.status)))
			throw new Error('Valid status is required');
		if (data.status && !statuses.has(String(data.status)))
			throw new Error('Invalid evidence status');
	}
	private static evidence(data: Record<string, unknown>) {
		if (typeof data.path !== 'string' || !data.path) throw new Error('Evidence path is required');
		if (data.phase && !['before', 'after', 'current'].includes(String(data.phase)))
			throw new Error('Invalid evidence phase');
		this.audio(data);
	}
	private static audio(data: Record<string, unknown>) {
		if (
			data.durationSeconds !== undefined &&
			(typeof data.durationSeconds !== 'number' ||
				!Number.isFinite(data.durationSeconds) ||
				data.durationSeconds < 0)
		)
			throw new Error('Invalid audio duration');
		if (
			data.transcript !== undefined &&
			(typeof data.transcript !== 'string' || data.transcript.length > 10000)
		)
			throw new Error('Invalid audio transcript');
	}
}
