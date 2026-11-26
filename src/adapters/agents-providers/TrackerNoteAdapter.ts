// @harness-uid u_2d4uqig2pk
import { QaSyncError } from '../../core/agents-providers/QaSyncError';
import type { QaTrackerItem, QaTrackerNotes } from '../../core/agents-providers/qaSync.types';
import type { TrackerNoteAdapterConfig } from './TrackerNoteAdapter.types';

const itemId = /^[a-z0-9]{6,12}$/;
const closed = new Set(['done', 'ignored']);

/** Lists one agent's open tracker items and appends notes. Nothing else is reachable. */
export class TrackerNoteAdapter implements QaTrackerNotes {
	constructor(private readonly config: TrackerNoteAdapterConfig) {}

	async openItems(): Promise<QaTrackerItem[]> {
		const out = await this.config.run(['list', '--agent', this.config.agent, '--json']);
		const rows: unknown = JSON.parse(out);
		if (!Array.isArray(rows)) throw new QaSyncError('Tracker returned unreadable output.');
		return (rows as Record<string, unknown>[]).flatMap((row) =>
			row.agent === this.config.agent &&
			row.sensitive !== true &&
			!closed.has(String(row.status)) &&
			typeof row.id === 'string' &&
			typeof row.title === 'string'
				? [{ id: row.id.slice(0, 6), title: row.title }]
				: []
		);
	}

	async note(id: string, text: string): Promise<void> {
		if (!itemId.test(id)) throw new QaSyncError('Invalid tracker item id.');
		if (!text || text.startsWith('-')) throw new QaSyncError('Invalid tracker note.');
		await this.config.run(['note', id, text]);
	}
}

export type { TrackerNoteAdapterConfig } from './TrackerNoteAdapter.types';
