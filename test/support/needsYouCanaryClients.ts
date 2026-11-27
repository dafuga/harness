import { DatabaseSync } from 'node:sqlite';
import { vi } from 'vitest';
import { MacTrackerInboxService } from '../../packages/desktop/src/lib/development-tooling/desktop-initialization/MacTrackerInboxService';
import { deliverHomeChat } from '../../packages/desktop/src/lib/development-tooling/desktop-initialization/tracker-overview-publisher/homeTrackerChat';
import { optionWrite } from '../../packages/desktop/src/lib/development-tooling/tracker-inbox/trackerInbox';
import type { InboxDetail } from '../../packages/desktop/src/models/development-tooling/TrackerInbox.types';
import { agentOpenAsks } from '../../packages/reports/src/lib/projects-sessions/hub-home/homeOpenAsks';
import type { HomeAgent } from '../../packages/reports/src/lib/projects-sessions/hub-home/hubHome.types';
import type {
	CanaryAsk,
	CanaryItem,
	CanarySurface
} from '../../scripts/needs-you-canary/canary.types';
import { addArgs, flagArgs } from '../../scripts/needs-you-canary/canaryAsk';
import { nativeTrackerArgs } from '../../src/commands/projects-sessions/tracker-command/nativeTrackerRequest';
import { TrackerItemReadRepository } from '../../src/repositories/projects-sessions/TrackerItemReadRepository';
import { TrackerLocalApiService } from '../../src/services/projects-sessions/TrackerLocalApiService';
import { TrackerPersistenceService } from '../../src/services/projects-sessions/TrackerPersistenceService';
import { PhoneReplicaWriteService } from '../../src/services/projects-sessions/tracker-phone-replica-service/PhoneReplicaWriteService';
import {
	attentionRevision,
	readPhoneReplicaItem
} from '../../src/services/projects-sessions/tracker-phone-replica-service/phoneReplicaRows';
import type { RealTracker } from './needsYouCanaryClients.types';

export type { RealTracker };

const at = Date.UTC(2026, 10, 27, 9);

/** A real in-memory Tracker: the store and local API the installed daemon runs. */
export function realTracker() {
	const database = new DatabaseSync(':memory:');
	const store = new TrackerPersistenceService(database, 'fixture-mac', { now: () => at });
	const api = new TrackerLocalApiService(store, new TrackerItemReadRepository(database), {
		now: () => at
	});
	const send = async (url: string, init?: RequestInit) =>
		api.handle(new Request(url.replace(/^http:\/\/[^/]+/, 'http://127.0.0.1:7700'), init));
	const read = async (path: string) =>
		(await (await send(`http://127.0.0.1:7700${path}`)).json()) as CanaryItem;
	return { database, store, send, read, close: () => database.close() };
}

/** Raises the canary's own ask with the canary's own command lines. */
export async function raise(tracker: RealTracker, ask: CanaryAsk): Promise<string> {
	const post = async (args: string[]) => {
		const { request } = nativeTrackerArgs(args);
		const response = await tracker.send(`http://127.0.0.1:7700${request.path}`, {
			method: 'POST',
			body: JSON.stringify(request.body)
		});
		return (await response.json()) as CanaryItem;
	};
	const { id } = await post(addArgs(ask));
	await post(flagArgs(id, ask));
	return id;
}

/** A tap the Tracker did not take is a broken fixture, never a canary verdict. */
function accepted(app: string, ok: boolean, why: string): void {
	if (!ok) throw new Error(`${app} tap was not accepted: ${why}`);
}

/** Hub web: the linked Mac delivers the tapped row to its Tracker. */
async function tapHubWeb(tracker: RealTracker, id: string, ask: CanaryAsk, option: number) {
	// The stored options: the Hub lists an ask only with exactly one recommended choice.
	const stored = (await tracker.read(`/items/${id}`)) as CanaryItem & {
		options: HomeAgent['options'];
	};
	const agent: HomeAgent = {
		id: 'harness',
		name: 'Harness',
		state: 'needs-you',
		sessions: 0,
		tasks: [],
		subAgents: { sessions: 0, tasks: [] },
		itemId: id,
		task: ask.title,
		machine: null,
		model: null,
		since: new Date(at).toISOString(),
		question: ask.question,
		options: stored.options,
		messages: []
	};
	const input = { id: 'chat-1', agentId: agent.id, itemId: id, question: ask.question };
	const tap = { ...input, kind: 'answer' as const, text: ask.labels[option - 1], option };
	const home = { agents: [agent], openAsks: agentOpenAsks([agent]) };
	const receipt = await deliverHomeChat(tap, home, tracker.send as typeof fetch);
	accepted('Hub web', receipt.status === 'sent', receipt.status);
}

/** Mac app: the Needs you page reads the item, then writes the reviewed option. */
async function tapMacApp(tracker: RealTracker, id: string, _ask: CanaryAsk, option: number) {
	vi.stubGlobal('fetch', tracker.send);
	try {
		const service = new MacTrackerInboxService();
		const detail = (await service.read({ operation: 'detail', id })).value as InboxDetail;
		const write = optionWrite(detail, { revision: detail.revision }, option);
		const reply = await service.write(write!);
		accepted('Mac app', Boolean(reply.value), reply.code ?? '');
	} finally {
		vi.unstubAllGlobals();
	}
}

/** iPhone: the phone's intent, committed by the Mac's phone write service. */
async function tapIphone(tracker: RealTracker, id: string, ask: CanaryAsk, option: number) {
	const writer = new PhoneReplicaWriteService(tracker.store, () => at, {
		device: 'phone',
		token: 't'.repeat(40)
	});
	const receipt = writer.push('a'.repeat(64), {
		version: 1,
		intentId: '00000000-0000-4000-8000-000000000001',
		itemId: id,
		action: 'answer',
		text: ask.labels[option - 1],
		revision: attentionRevision(readPhoneReplicaItem(tracker.database, id, at)!),
		option
	});
	accepted('iPhone', receipt.status === 'accepted', receipt.status);
}

export const tapThrough: Record<
	CanarySurface,
	(tracker: RealTracker, id: string, ask: CanaryAsk, option: number) => Promise<void>
> = { web: tapHubWeb, mac: tapMacApp, iphone: tapIphone };
