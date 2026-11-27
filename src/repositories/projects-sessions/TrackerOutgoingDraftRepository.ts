// @harness-uid u_4snu2qhejr
import type { SqliteDatabase, SqliteValue } from '../../core/development-tooling/sqliteTypes';
import type {
	NewTrackerOutgoingDraft,
	TrackerOutgoingAttempt,
	TrackerOutgoingDraft,
	TrackerOutgoingDraftRow,
	TrackerOutgoingMessage,
	TrackerOutgoingReceipt,
	TrackerOutgoingResult,
	TrackerOutgoingRevision
} from './TrackerOutgoingDraftRepository.types';

const schema = `
	CREATE TABLE IF NOT EXISTS outgoing_drafts (
		id TEXT PRIMARY KEY NOT NULL,
		itemId TEXT NOT NULL,
		conversationId TEXT NOT NULL,
		by TEXT NOT NULL,
		at INTEGER NOT NULL,
		message TEXT NOT NULL,
		revision INTEGER NOT NULL DEFAULT 1,
		status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft', 'sent', 'discarded')),
		delivery TEXT NOT NULL DEFAULT 'idle' CHECK(delivery IN ('idle', 'sending', 'failed', 'unconfirmed')),
		updatedBy TEXT NOT NULL,
		updatedAt INTEGER NOT NULL,
		receipt TEXT,
		attempt TEXT
	);
	CREATE INDEX IF NOT EXISTS outgoing_drafts_conversation
		ON outgoing_drafts(conversationId, at DESC, id DESC);
`;
const fields =
	'id, itemId, conversationId, by, at, message, revision, status, delivery, updatedBy, updatedAt, receipt';
const actionable = "status = 'draft' AND delivery IN ('idle', 'failed')";

/** Saves outgoing draft revisions and atomically reserves each approved delivery attempt. */
export class TrackerOutgoingDraftRepository {
	constructor(private readonly database: SqliteDatabase) {}

	initialize(): void {
		this.database.exec(schema);
	}

	create(draft: NewTrackerOutgoingDraft): TrackerOutgoingDraft {
		const row = this.database
			.prepare(
				`INSERT INTO outgoing_drafts (id, itemId, conversationId, by, at, message, updatedBy, updatedAt)
				VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING ${fields}`
			)
			.get(
				draft.id,
				draft.itemId,
				draft.conversationId,
				draft.by,
				draft.at,
				JSON.stringify(draft.message),
				draft.by,
				draft.at
			);
		return readDraft(row as TrackerOutgoingDraftRow);
	}

	find(id: string): TrackerOutgoingDraft | undefined {
		const row = this.database.prepare(`SELECT ${fields} FROM outgoing_drafts WHERE id = ?`).get(id);
		return row ? readDraft(row as TrackerOutgoingDraftRow) : undefined;
	}

	list(conversationId: string, limit = 100): TrackerOutgoingDraft[] {
		const rows = this.database
			.prepare(
				`SELECT ${fields} FROM outgoing_drafts WHERE conversationId = ?
				ORDER BY at DESC, id DESC LIMIT ?`
			)
			.all(conversationId, limit) as TrackerOutgoingDraftRow[];
		return rows.map(readDraft);
	}

	edit(version: TrackerOutgoingRevision, message: TrackerOutgoingMessage) {
		return this.change(
			version,
			"message = ?, revision = revision + 1, delivery = 'idle', attempt = NULL",
			actionable,
			[JSON.stringify(message)]
		);
	}

	discard(version: TrackerOutgoingRevision) {
		return this.change(
			version,
			"status = 'discarded', delivery = 'idle', attempt = NULL",
			actionable,
			[]
		);
	}

	reserve(version: TrackerOutgoingRevision, attempt: string) {
		return this.change(version, "delivery = 'sending', attempt = ?", actionable, [attempt]);
	}

	finish(version: TrackerOutgoingAttempt, result: TrackerOutgoingResult) {
		const delivered = result.kind === 'sent';
		return this.change(
			version,
			'status = ?, delivery = ?, receipt = ?',
			"status = 'draft' AND delivery IN ('sending', 'unconfirmed') AND attempt = ?",
			[
				delivered ? 'sent' : 'draft',
				delivered ? 'idle' : result.kind,
				delivered ? JSON.stringify(result.receipt) : null,
				version.attempt
			]
		);
	}

	private change(
		{ id, revision, by, at }: TrackerOutgoingRevision,
		updates: string,
		where: string,
		bindings: SqliteValue[]
	): TrackerOutgoingDraft | undefined {
		const fieldCount = updates.split('?').length - 1;
		const row = this.database
			.prepare(
				`UPDATE outgoing_drafts SET ${updates}, updatedBy = ?, updatedAt = ?
			WHERE id = ? AND revision = ? AND ${where} RETURNING ${fields}`
			)
			.get(...bindings.slice(0, fieldCount), by, at, id, revision, ...bindings.slice(fieldCount));
		return row ? readDraft(row as TrackerOutgoingDraftRow) : undefined;
	}
}

function readDraft({ message, receipt, ...row }: TrackerOutgoingDraftRow): TrackerOutgoingDraft {
	return {
		...row,
		message: JSON.parse(message) as TrackerOutgoingMessage,
		receipt: receipt ? (JSON.parse(receipt) as TrackerOutgoingReceipt) : null
	};
}
