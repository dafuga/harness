// @harness-uid u_xhueog5n2u
import { createHash, timingSafeEqual } from 'node:crypto';
import { TrackerItemReadRepository } from '../../../repositories/projects-sessions/TrackerItemReadRepository';
import type { TrackerItemInput } from '../../../utils/projects-sessions/normalizeTrackerItemFields.types';
import { planTrackerItemMutation } from '../../../utils/projects-sessions/planTrackerItemMutation';
import { sanitizeTrackerText } from '../../../utils/projects-sessions/sanitizeTrackerText';
import { trackerItemError } from '../../../utils/projects-sessions/trackerItemError';
import type { TrackerPersistenceService } from '../TrackerPersistenceService';
import { attentionRevision, readPhoneReplicaItem } from './phoneReplicaRows';
import {
	isPhoneReplicaAction,
	needsOpenFlag,
	phoneReplicaActions,
	statusGuarded
} from './phoneReplicaActions';
import type {
	PhoneReplicaIntent,
	PhoneReplicaReceipt,
	PhoneReplicaWriteGrant
} from './PhoneReplicaWriteService.types';

const opaqueHash = /^[a-f0-9]{64}$/;
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const allowedFields = new Set([
	'version',
	'intentId',
	'itemId',
	'action',
	'text',
	'revision',
	'expectedStatus',
	'option',
	'confirmed'
]);

function digest(value: string): Buffer {
	return createHash('sha256').update(value).digest();
}

/** Commits an authorized phone intent and its replay receipt under the Tracker journal lock. */
export class PhoneReplicaWriteService {
	private readonly items: TrackerItemReadRepository;
	private readonly tokenHash: Buffer | undefined;

	constructor(
		private readonly store: TrackerPersistenceService,
		private readonly now: () => number,
		private readonly grant: PhoneReplicaWriteGrant
	) {
		this.items = new TrackerItemReadRepository(store.database);
		this.tokenHash = grant.token.length >= 32 ? digest('Bearer ' + grant.token) : undefined;
	}

	scope(headers: Headers): string | null {
		const presented = headers.get('authorization') ?? '';
		const scope = headers.get('x-tracker-phone-scope') ?? '';
		if (!this.tokenHash || headers.get('x-tracker-phone-device') !== this.grant.device) return null;
		return opaqueHash.test(scope) && timingSafeEqual(digest(presented), this.tokenHash)
			? scope
			: null;
	}

	push(scope: string, fields: TrackerItemInput): PhoneReplicaReceipt {
		const intent = parseIntent(fields);
		const now = this.now();
		const requestHash = digest(JSON.stringify(intent)).toString('hex');
		const { database } = this.store;
		return this.store.commitLocal<PhoneReplicaReceipt>(() => {
			database.exec(receiptTable);
			const previous = database.prepare(readReceipt).get(scope, intent.intentId) as
				| { request_hash: string }
				| undefined;
			const accepted = { intentId: intent.intentId, status: 'accepted' } as const;
			if (previous)
				return {
					result: previous.request_hash === requestHash ? accepted : conflict(intent, 'intent')
				};
			const item = readPhoneReplicaItem(database, intent.itemId, now);
			if (!item) return { result: conflict(intent, 'item') };
			if (intent.action !== 'note' && !matchesAttention(intent, item))
				return { result: conflict(intent, 'attention') };
			if (statusGuarded.has(intent.action) && item.status !== intent.expectedStatus)
				return { result: conflict(intent, 'attention') };
			const plan = this.plan(intent, now);
			if (!plan) return { result: conflict(intent, 'duplicate') };
			database.prepare(writeReceipt).run(scope, intent.intentId, requestHash);
			return {
				result: accepted,
				operation: {
					itemId: intent.itemId,
					fields: plan.fields,
					actor: intent.action === 'flag' ? 'Daniel@harness-studio' : 'Harness Studio'
				}
			};
		});
	}

	private plan(intent: PhoneReplicaIntent, now: number) {
		const { action, itemId, text } = intent;
		const body =
			intent.option === null
				? { [phoneReplicaActions[action].field]: text }
				: { option: intent.option, confirmed: intent.confirmed, by: 'Daniel' };
		const asksDaniel = action === 'flag' || action === 'block';
		try {
			return planTrackerItemMutation(
				{ action, item: this.items.resolve(itemId), body },
				{ now, node: this.store.node, candidates: asksDaniel ? this.items.candidates() : [] }
			);
		} catch (error) {
			if (error instanceof Error && 'status' in error && error.status === 409) return undefined;
			throw error;
		}
	}
}

function parseIntent(fields: Record<string, unknown>): PhoneReplicaIntent {
	checkIntentEnvelope(fields);
	const { itemId, intentId, action, text, revision = null, expectedStatus = null } = fields;
	if (typeof itemId !== 'string' || !/^[a-z0-9_-]{1,80}$/.test(itemId))
		throw trackerItemError('invalid phone item id');
	if (typeof intentId !== 'string' || !uuid.test(intentId))
		throw trackerItemError('invalid phone intent id');
	if (!isPhoneReplicaAction(action)) throw trackerItemError('invalid phone action');
	return {
		itemId,
		intentId,
		action,
		text: parseIntentText(action, text),
		revision: parseRevision(action, revision),
		expectedStatus: parseExpectedStatus(action, expectedStatus),
		...parseChoice(action, fields)
	};
}

/** A tapped option is only for answers: its 1-based number and whether the confirm step was done. */
function parseChoice(action: PhoneReplicaIntent['action'], fields: Record<string, unknown>) {
	const { option = null, confirmed = false } = fields;
	const valid =
		typeof confirmed === 'boolean' &&
		(option === null ||
			(action === 'answer' &&
				Number.isInteger(option) &&
				Number(option) >= 1 &&
				Number(option) <= 4));
	if (!valid) throw trackerItemError('invalid phone option');
	return { option: option as number | null, confirmed };
}

function checkIntentEnvelope(fields: Record<string, unknown>): void {
	if (fields.version !== 1 || Object.keys(fields).some((key) => !allowedFields.has(key)))
		throw trackerItemError('invalid phone write version or fields');
}

function parseIntentText(action: PhoneReplicaIntent['action'], text: unknown): string {
	if (
		typeof text !== 'string' ||
		(phoneReplicaActions[action].required && !text.trim()) ||
		Buffer.byteLength(text) > 512 ||
		sanitizeTrackerText(text) !== text
	)
		throw trackerItemError('invalid phone write text');
	return text;
}

function parseExpectedStatus(action: PhoneReplicaIntent['action'], status: unknown): string | null {
	if (!statusGuarded.has(action)) {
		if (status === null) return null;
		throw trackerItemError('invalid phone expected status');
	}
	if (typeof status === 'string' && /^[a-z_]{2,20}$/.test(status)) return status;
	throw trackerItemError('invalid phone expected status');
}

function parseRevision(action: PhoneReplicaIntent['action'], revision: unknown): string | null {
	if (action === 'note' && revision === null) return null;
	if (action !== 'note' && typeof revision === 'string' && opaqueHash.test(revision))
		return revision;
	throw trackerItemError('invalid phone attention revision');
}

function matchesAttention(
	intent: PhoneReplicaIntent,
	item: Parameters<typeof attentionRevision>[0]
) {
	return (
		intent.revision === attentionRevision(item) &&
		(!needsOpenFlag.has(intent.action) || Boolean(item.needs_daniel && !item.resolved))
	);
}

function conflict(
	intent: PhoneReplicaIntent,
	reason: Extract<PhoneReplicaReceipt, { status: 'conflict' }>['reason']
): PhoneReplicaReceipt {
	return { intentId: intent.intentId, status: 'conflict', reason };
}

const receiptTable = `
	CREATE TABLE IF NOT EXISTS phone_replica_write_receipts (
		scope TEXT NOT NULL,
		intent_id TEXT NOT NULL,
		request_hash TEXT NOT NULL,
		PRIMARY KEY (scope, intent_id)
	) WITHOUT ROWID
`;
const readReceipt =
	'SELECT request_hash FROM phone_replica_write_receipts WHERE scope = ? AND intent_id = ?';
const writeReceipt =
	'INSERT INTO phone_replica_write_receipts(scope, intent_id, request_hash) VALUES (?, ?, ?)';
