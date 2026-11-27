// @harness-uid u_kg5hqz6vwx
import { appendFile, readFile } from 'node:fs/promises';
import { isAbsolute } from 'node:path';
import type { QaLedgerLine as Line } from './QaLedgerRepository.types';

/** Durable issue-to-thread ledger. Reserve-before-post gives at-most-once delivery per label event. */
export class QaLedgerRepository {
	constructor(private readonly path: string) {
		if (!isAbsolute(path)) throw new TypeError('The QA ledger requires an absolute path.');
	}

	async hasReservation(eventId: string, issue: number): Promise<boolean> {
		return (await this.read()).some((line) => line.eventId === eventId || line.issue === issue);
	}

	/** 'new' only the first time an event id or an issue is seen. */
	async reserve(eventId: string, issue: number): Promise<'new' | 'duplicate'> {
		if (await this.hasReservation(eventId, issue)) return 'duplicate';
		await this.append({ kind: 'reserved', eventId, issue, at: new Date().toISOString() });
		return 'new';
	}

	async recordPost(
		eventId: string,
		issue: number,
		channelId: string,
		parentTs: string
	): Promise<void> {
		await this.append({
			kind: 'posted',
			eventId,
			issue,
			channelId,
			parentTs,
			at: new Date().toISOString()
		});
	}

	/** Reservations without a post: delivery state unknown, reconcile in Slack before retrying. */
	async unresolved(): Promise<number[]> {
		const lines = await this.read();
		const posted = new Set(lines.filter((l) => l.kind === 'posted').map((l) => l.eventId));
		return lines.filter((l) => l.kind === 'reserved' && !posted.has(l.eventId)).map((l) => l.issue);
	}

	private async read(): Promise<Line[]> {
		const raw = await readFile(this.path, 'utf8').catch((error: { code?: string }) => {
			if (error.code === 'ENOENT') return '';
			throw error;
		});
		return raw
			.split('\n')
			.filter(Boolean)
			.map((line) => JSON.parse(line) as Line);
	}

	private async append(line: Line): Promise<void> {
		await appendFile(this.path, JSON.stringify(line) + '\n', { mode: 0o600 });
	}
}
