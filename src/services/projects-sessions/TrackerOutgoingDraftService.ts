// @harness-uid u_4usb4rrlje
import { randomUUID } from 'node:crypto';
import { TrackerOutgoingDraftRepository } from '../../repositories/projects-sessions/TrackerOutgoingDraftRepository';
import type {
	TrackerOutgoingDraft,
	TrackerOutgoingMessage,
	TrackerOutgoingResult,
	TrackerOutgoingRevision
} from '../../repositories/projects-sessions/TrackerOutgoingDraftRepository.types';
import { trackerItemError } from '../../utils/projects-sessions/trackerItemError';
import type {
	TrackerOutgoingActor,
	TrackerOutgoingDraftServiceOptions,
	TrackerOutgoingSender
} from './TrackerOutgoingDraftService.types';
import type { TrackerPersistenceService } from './TrackerPersistenceService';
import {
	outgoingReceipt,
	parseOutgoingDraft,
	parseOutgoingEditor,
	parseOutgoingRevision
} from './tracker-outgoing-draft-service/outgoingDraftInput';

const conversation = 'cos';

/** CoS drafts are published separately from the single owner-authorized delivery attempt. */
export class TrackerOutgoingDraftService {
	private readonly drafts: TrackerOutgoingDraftRepository;

	constructor(
		private readonly store: TrackerPersistenceService,
		private readonly options: TrackerOutgoingDraftServiceOptions = {}
	) {
		this.drafts = new TrackerOutgoingDraftRepository(store.database);
		this.drafts.initialize();
	}

	create(input: unknown, actor: TrackerOutgoingActor): TrackerOutgoingDraft {
		const draft = parseOutgoingDraft(input);
		return this.store.commitLocal(() => {
			const existing = this.drafts.find(draft.id);
			if (existing) {
				if (
					existing.by !== actor.by ||
					existing.itemId !== draft.itemId ||
					JSON.stringify(existing.message) !== JSON.stringify(draft.message)
				)
					throw trackerItemError('draft id already in use', 409);
				return { result: existing };
			}
			const item = this.store.database
				.prepare('SELECT 1 FROM items WHERE id = ? AND deleted = 0')
				.get(draft.itemId);
			if (!item) throw trackerItemError('draft task not found', 404);
			return {
				result: this.drafts.create({
					...draft,
					by: actor.by,
					at: this.now(),
					conversationId: conversation
				})
			};
		});
	}

	list(actor: TrackerOutgoingActor): TrackerOutgoingDraft[] {
		return this.drafts.list(conversation, 100, actor.kind === 'agent' ? actor.by : undefined);
	}

	/** A missing channel/account binding cannot accept an owner approval. */
	reviewQueue() {
		return this.list({ kind: 'owner', by: 'Daniel' }).map((draft) => ({
			...draft,
			canSend: draft.status === 'draft' && Boolean(this.options.provider?.(draft.message))
		}));
	}

	edit(input: unknown, editor: unknown, actor: TrackerOutgoingActor): TrackerOutgoingDraft {
		const version = this.approval(input, actor);
		const current = this.current(version);
		const message = parseOutgoingEditor(editor, current.message);
		return requireDraft(this.drafts.edit(version, message));
	}

	discard(input: unknown, actor: TrackerOutgoingActor): TrackerOutgoingDraft {
		const version = this.approval(input, actor);
		return this.record(() => this.drafts.discard(version), 'discarded');
	}

	async send(input: unknown, actor: TrackerOutgoingActor): Promise<TrackerOutgoingDraft> {
		const version = this.approval(input, actor);
		const current = this.current(version);
		const send = this.options.provider?.(current.message);
		if (!send) throw trackerItemError('sending account unavailable', 409);
		const attempt = randomUUID();
		const reserved = this.record(() => this.drafts.reserve(version, attempt), 'approved');
		const result = await sendDraft(send, reserved.message, attempt);
		return this.record(
			() => this.drafts.finish({ ...version, attempt, at: this.now() }, result),
			result.kind
		);
	}

	private approval(input: unknown, actor: TrackerOutgoingActor): TrackerOutgoingRevision {
		if (actor.kind !== 'owner') throw trackerItemError('owner approval required', 403);
		return { ...parseOutgoingRevision(input), by: actor.by, at: this.now() };
	}

	private current({ id, revision }: TrackerOutgoingRevision) {
		const current = this.drafts.find(id);
		if (
			current?.revision !== revision ||
			current.status !== 'draft' ||
			current.delivery === 'sending' ||
			current.delivery === 'unconfirmed'
		)
			throw trackerItemError('draft changed', 409);
		return current;
	}

	private record(
		apply: () => TrackerOutgoingDraft | undefined,
		outcome: 'approved' | 'discarded' | TrackerOutgoingResult['kind']
	) {
		return this.store.commitLocal(() => {
			const result = requireDraft(apply());
			return {
				result,
				operation: {
					itemId: result.itemId,
					actor: result.updatedBy,
					fields: {
						'note+': `Outgoing draft ${result.id} ${outcome} (revision ${result.revision})`
					}
				}
			};
		});
	}

	private now() {
		return (this.options.now ?? Date.now)();
	}
}

function requireDraft(draft: TrackerOutgoingDraft | undefined) {
	if (!draft) throw trackerItemError('draft changed', 409);
	return draft;
}

async function sendDraft(
	send: TrackerOutgoingSender,
	message: TrackerOutgoingMessage,
	attempt: string
) {
	try {
		const result = await send(message, attempt);
		if (result.kind === 'failed') return result;
		if (result.kind === 'sent' && outgoingReceipt.safeParse(result.receipt).success) return result;
	} catch {
		// A transport error can occur after the provider accepted the message.
	}
	return { kind: 'unconfirmed' } as const;
}
