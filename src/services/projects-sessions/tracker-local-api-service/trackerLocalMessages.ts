// @harness-uid u_g7kdpz7bel
import type { TrackerItemReadRepository } from '../../../repositories/projects-sessions/TrackerItemReadRepository';
import { planTrackerItemMutation } from '../../../utils/projects-sessions/planTrackerItemMutation';
import { trackerItemError } from '../../../utils/projects-sessions/trackerItemError';
import {
	formatHubMessageNote,
	formatHubReplyNote,
	hubMessageId,
	hubMessageItem,
	hubMessageLine,
	hubSessionMessages
} from '../../../utils/projects-sessions/hubSessionMessages';
import type { HubMessageTarget } from '../../../utils/projects-sessions/hubSessionMessages.types';
import type { TrackerLocalApiOptions } from '../TrackerLocalApiService.types';
import type { TrackerPersistenceService } from '../TrackerPersistenceService';
import { itemMutation, itemMutationContext, readItemBody } from './trackerLocalItemMutation';

/** The thread item Chief of Staff's Hub messages live on; created on the first message. */
export const cosChatTitle = 'Hub chat with Chief of Staff';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface MessageDependencies {
	store: TrackerPersistenceService;
	items: TrackerItemReadRepository;
	options: TrackerLocalApiOptions;
	actor: string | null;
}

/** `POST /messages` stores one Hub message; `POST /messages/<id>/reply` answers it. */
export async function trackerMessageEndpoint(
	request: Request,
	parts: string[],
	dependencies: MessageDependencies
): Promise<{ status: number; body: object } | undefined> {
	if (request.method !== 'POST') return undefined;
	if (parts.length === 1) return storeMessage(await readItemBody(request), dependencies);
	if (parts.length === 3 && parts[2] === 'reply')
		return replyTo(parts[1], await readItemBody(request), dependencies);
	return undefined;
}

function storeMessage(body: Record<string, unknown>, dependencies: MessageDependencies) {
	const text = messageText(body.text);
	if (typeof body.id !== 'string' || !uuid.test(body.id)) throw trackerItemError('invalid id');
	const target = messageTarget(body.target);
	const itemId =
		target.kind === 'cos' ? cosChatItem(dependencies) : exactItem(dependencies, target.item);
	const id = hubMessageId(itemId, body.id);
	if (!id) throw trackerItemError('invalid message item');
	const receipt = { id, item: itemId, status: 'stored' };
	if (thread(dependencies.items, itemId).some((message) => message.id === id))
		return { status: 200, body: receipt };
	if (target.kind === 'run' && endedRun(target, itemId, dependencies.options))
		return { status: 409, body: { error: 'that session has ended', status: 'refused' } };
	const where: HubMessageTarget =
		target.kind === 'cos' ? target : { kind: 'run', node: target.node, runId: target.run };
	note(dependencies, itemId, formatHubMessageNote(id, where, text));
	return { status: 201, body: receipt };
}

function replyTo(id: string, body: Record<string, unknown>, dependencies: MessageDependencies) {
	const itemId = hubMessageItem(id);
	if (!itemId) throw trackerItemError('invalid message id');
	const text = messageText(body.text);
	const known = Boolean(exactItem(dependencies, itemId, false));
	if (!known || !thread(dependencies.items, itemId).some((message) => message.id === id))
		throw trackerItemError(`no Hub message ${id}`, 404);
	note(dependencies, itemId, formatHubReplyNote(id, text));
	return { status: 200, body: { id, item: itemId, status: 'acknowledged' } };
}

function messageText(value: unknown): string {
	const text = typeof value === 'string' ? hubMessageLine(value) : '';
	if (!text || text.length > 2000) throw trackerItemError('message text must be 1-2000 characters');
	return text;
}

type RequestTarget = { kind: 'cos' } | { kind: 'run'; item: string; node: string; run: number };

function messageTarget(value: unknown): RequestTarget {
	if (value === 'cos') return { kind: 'cos' };
	const { item, node, run } = (value ?? {}) as Record<string, unknown>;
	if (
		typeof item !== 'string' ||
		typeof node !== 'string' ||
		!/^[^\s#]{1,100}$/.test(node) ||
		typeof run !== 'number' ||
		!Number.isSafeInteger(run) ||
		run < 1
	)
		throw trackerItemError('target must be "cos" or { item, node, run }');
	return { kind: 'run', item, node, run };
}

/** A run this computer knows has ended, or belongs to another item, is never written to. */
function endedRun(
	target: Extract<RequestTarget, { kind: 'run' }>,
	itemId: string,
	options: TrackerLocalApiOptions
): boolean {
	const known = options.runs
		?.list({ itemId })
		.find((run) => run.id === target.run && (run.node ?? null) === target.node);
	return Boolean(known && (known.ended_at !== null || known.state !== 'running'));
}

/** Exact ids only: a prefix that happens to match another item never receives a message. */
function exactItem({ store }: MessageDependencies, id: string, required = true): string {
	const row = store.database
		.prepare('SELECT id FROM items WHERE id = ? AND deleted = 0')
		.get(id) as { id: string } | undefined;
	if (!row && required) throw trackerItemError(`no item "${id}"`, 404);
	return row?.id ?? '';
}

function thread(items: TrackerItemReadRepository, itemId: string) {
	return hubSessionMessages(items.getStored(itemId).notes_log);
}

function note({ store, actor }: MessageDependencies, itemId: string, text: string) {
	store.appendLocal({ itemId, fields: { 'note+': text }, actor });
}

/** The oldest live Chief of Staff chat item, so every computer converges on one thread. */
function cosChatItem({ store, items, options, actor }: MessageDependencies): string {
	const existing = store.database
		.prepare(
			`SELECT id FROM items WHERE deleted = 0 AND agent = 'cos' AND kind = 'plan' AND title = ?
			 ORDER BY created_at, id LIMIT 1`
		)
		.get(cosChatTitle) as { id: string } | undefined;
	if (existing) return existing.id;
	const body = { title: cosChatTitle, kind: 'plan', owner: 'Chief of Staff', agent: 'cos' };
	const context = itemMutationContext(store, items, options);
	const plan = planTrackerItemMutation(itemMutation('add', '', body, items), {
		...context,
		candidates: []
	});
	store.appendLocal({ itemId: plan.itemId, fields: plan.fields, actor });
	return plan.itemId;
}
