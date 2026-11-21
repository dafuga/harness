// @harness-uid u_bl6xl2h4a3
import { createHash } from 'node:crypto';
import type {
	TrackerGuestRequest,
	TrackerGuestSigningKey
} from '../../../adapters/agents-providers/module-task-runner-adapter/dockerTrackerGuest.types';
import {
	trackerGuestPath,
	trackerGuestRequestSchema
} from '../../../adapters/agents-providers/module-task-runner-adapter/dockerTrackerGuestProtocol';
import { TrackerSchemaAdapter } from '../../../adapters/projects-sessions/TrackerSchemaAdapter';
import { TrackerItemReadRepository } from '../../../repositories/projects-sessions/TrackerItemReadRepository';
import { dispatchRunRows } from '../../../repositories/projects-sessions/tracker-dispatch-repository/dispatchRunRows';
import { planTrackerItemMutation } from '../../../utils/projects-sessions/planTrackerItemMutation';
import { trackerItemError } from '../../../utils/projects-sessions/trackerItemError';
import { attemptKey } from '../../agents-providers/tracker-dispatcher-service/launchEligibility';
import type { TrackerRunReceipt } from '../../agents-providers/TrackerDispatcherService.types';
import { TrackerSyncAuthService } from '../../networking-security/TrackerSyncAuthService';
import { readTrackerHubBody } from '../tracker-hub-sync/hubHttp';
import type { TrackerNativeRuntimeOptions } from '../TrackerNativeRuntimeService.types';
import type { TrackerPersistenceService } from '../TrackerPersistenceService';
import { guestCommandFailure, guestTrackerResponse } from './guestTrackerResponse';
import type { GuestCommandContext, GuestCommandReceipt } from './guestTrackerCommands.types';

const denied = () => trackerItemError('guest scope denied', 403);
const inactive = () => trackerItemError('inactive Tracker run', 409);

/** Accept only a local, host-signed command for an admitted attempt. */
export class TrackerGuestCommandApi {
	private readonly items: TrackerItemReadRepository;
	private readonly schema: TrackerSchemaAdapter;

	constructor(
		private readonly store: TrackerPersistenceService,
		private readonly signingKey: TrackerGuestSigningKey,
		private readonly options: Pick<TrackerNativeRuntimeOptions, 'now' | 'timeZone'>
	) {
		this.items = new TrackerItemReadRepository(store.database);
		this.schema = new TrackerSchemaAdapter(store.database);
	}

	async handle(request: Request): Promise<Response> {
		try {
			const { command, body } = await readGuestCommand(request);
			return this.command(command, body, request);
		} catch (error) {
			return guestCommandFailure(guestFailureStatus(error));
		}
	}

	private command(command: TrackerGuestRequest, body: string, request: Request): Response {
		const [itemId, , action] = command;
		const now = (this.options.now ?? Date.now)();
		request.signal.throwIfAborted();
		const run = this.store.commitLocal(() => {
			const run = authorizedGuestRun(this.store, this.signingKey, command, {
				body,
				headers: request.headers
			});
			return decideGuestCommand(
				this.store,
				{
					items: this.items,
					schema: this.schema,
					now,
					timeZone: this.options.timeZone
				},
				run,
				command
			);
		});
		return guestTrackerResponse(this.items.getStored(itemId), run, action === 'show');
	}
}

function guestFailureStatus(error: unknown): number {
	if (error instanceof SyntaxError) return 400;
	if (error && typeof error === 'object' && 'status' in error && typeof error.status === 'number')
		return error.status;
	return 503;
}

async function readGuestCommand(request: Request) {
	const { pathname, search } = new URL(request.url);
	if (request.method !== 'POST' || pathname !== trackerGuestPath || search) throw denied();
	const body = await readTrackerHubBody(
		{
			method: 'POST',
			pathAndQuery: trackerGuestPath,
			headers: request.headers,
			body: request.body,
			signal: request.signal
		},
		4096
	);
	const parsed = trackerGuestRequestSchema.safeParse(JSON.parse(body));
	if (!parsed.success) throw trackerItemError('invalid guest command');
	return { command: parsed.data, body };
}

function authorizedGuestRun(
	store: TrackerPersistenceService,
	signingKey: TrackerGuestSigningKey,
	[itemId, runId]: TrackerGuestRequest,
	{ body, headers }: { body: string; headers: Headers }
): TrackerRunReceipt {
	const authorization = headers.get('authorization');
	if (!authorization) throw denied();
	const { database, node } = store;
	const run = dispatchRunRows(database, node, itemId).find(
		(row) =>
			row.id === runId && row.node === node && row.revision >= 0 && row.dispatch_at !== undefined
	);
	if (!run) throw denied();
	const key = signingKey({ itemId, runId, attemptKey: attemptKey(run) });
	try {
		const auth = new TrackerSyncAuthService(key);
		const signed = { method: 'POST', pathAndQuery: trackerGuestPath, body };
		if (!auth.verify(signed, authorization)) throw denied();
		return run;
	} finally {
		key.fill(0);
	}
}

function decideGuestCommand(
	store: TrackerPersistenceService,
	context: GuestCommandContext,
	run: TrackerRunReceipt,
	[itemId, , action, text]: TrackerGuestRequest
) {
	const { items, schema, now, timeZone } = context;
	const item = items.resolve(itemId);
	if (item.id !== itemId || item.every) throw denied();
	const receiptKey = 'harness_guest_commands:' + run.id + ':' + digest(attemptKey(run));
	const { commands, completed } = readGuestReceipt(schema, receiptKey);
	checkGuestRun(item, run, completed, now);
	const hash = digest(JSON.stringify([action, text]));
	if (action === 'show' || commands.includes(hash)) return { result: run };
	checkGuestWrite(completed, run, item.status);
	if (commands.length >= 256) throw trackerItemError('guest write limit reached', 409);
	const { fields } = planTrackerItemMutation(
		{
			action,
			item,
			body: guestActionBody(action, text)
		},
		{ node: store.node, now, timeZone, candidates: items.candidates() }
	);
	schema.setMeta(
		receiptKey,
		JSON.stringify({ commands: [...commands, hash], completed: action === 'done' })
	);
	return {
		result: run,
		operation: { itemId, fields, actor: 'docker-run:' + run.id + '@' + store.node }
	};
}

function readGuestReceipt(schema: TrackerSchemaAdapter, key: string): GuestCommandReceipt {
	const value = schema.getMeta(key);
	return value ? (JSON.parse(value) as GuestCommandReceipt) : { commands: [], completed: false };
}

function checkGuestWrite(
	completed: boolean,
	run: TrackerRunReceipt,
	itemStatus: string | null
): void {
	if (completed || run.state === 'finished' || itemStatus === 'done') throw inactive();
}

function checkGuestRun(
	item: { status: string | null; auto: string | null },
	run: TrackerRunReceipt,
	completed: boolean,
	now: number
) {
	const terminalReplay = completed && item.status === 'done';
	if (
		item.status === 'ignored' ||
		(item.auto !== run.auto_token && !(terminalReplay && !item.auto))
	)
		throw inactive();
	if (run.state !== 'finished') return;
	if (!terminalReplay || !recentGuestCompletion(run, now)) throw inactive();
}

function recentGuestCompletion(run: TrackerRunReceipt, now: number): boolean {
	return run.outcome === 'done' && run.ended_at !== null && now - run.ended_at <= 120_000;
}

function guestActionBody(action: string, text: string | null) {
	switch (action) {
		case 'note':
		case 'progress':
			return { text };
		case 'flag':
			return { question: text };
		case 'block':
			return { reason: text };
		case 'done':
			return { note: text };
		default:
			return {};
	}
}

function digest(text: string): string {
	return createHash('sha256').update(text).digest('hex');
}
