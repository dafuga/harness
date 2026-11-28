// @harness-uid u_evpsejqo7k
import type { HomeChatReceipt } from '$reports/lib/projects-sessions/hub-home/hubHome.types';
import { coalesced } from '$reports/lib/projects-sessions/realtime/coalesced';
import { LinkedHomeService } from '../../services/networking-security/LinkedHomeService';
import type { TrackerAttachmentDocument } from '../../../../../src/utils/projects-sessions/trackerAttachment.types';
import { readHome } from './hubHomeClient';
import type { HubHomeReadOptions, HubHomeReads, LinkedHomeSession } from './hubHomeReads.types';
export type { HubHomeReadOptions, HubHomeReads } from './hubHomeReads.types';

const followMs = 5 * 60_000;
const followEveryMs = 3000;

/** While a message is fresh, its receipt and reply are read every few seconds. */
function freshFollower(closed: () => boolean, read: () => void) {
	let until = 0;
	let timer: ReturnType<typeof setInterval> | undefined;
	function stop() {
		clearInterval(timer);
		timer = undefined;
	}
	function start() {
		until = performance.now() + followMs;
		timer ??= setInterval(() => {
			if (closed() || performance.now() > until) stop();
			else read();
		}, followEveryMs);
	}
	return { start, stop, read };
}

function homeDocumentReader(
	{ api, actor }: HubHomeReadOptions,
	session: () => LinkedHomeSession | undefined,
	closed: () => boolean
): HubHomeReads['readDocument'] {
	return async ({ id }) => {
		const reader = actor();
		if (!reader || closed()) return null;
		const current = session();
		const linked = current?.actor === reader ? await current.service.readDocument(id) : null;
		if (closed() || reader !== actor()) return null;
		const document =
			linked ?? (await api.get<TrackerAttachmentDocument>('/api/hub-home/doc', { id }));
		return !closed() && reader === actor() ? document : null;
	};
}

/**
 * What a change notice reads again: the published Home and the linked computers. Each has one
 * flight at a time, so a burst of notices cannot discard every answer before it lands.
 */
export function hubHomeReads(options: HubHomeReadOptions): HubHomeReads {
	const { api, actor } = options;
	let linkedHome: LinkedHomeSession | undefined;
	let closed = false;
	const stored = coalesced(async () => {
		const reader = actor();
		const result = await readHome(api);
		if (!closed && reader === actor()) options.home(result);
	});
	const linked = coalesced(async () => {
		const reader = actor();
		if (!reader || closed) return;
		if (linkedHome?.actor !== reader) {
			linkedHome?.service.close();
			linkedHome = { actor: reader, service: new LinkedHomeService(api, reader) };
		}
		const result = await linkedHome.service.read();
		if (!closed && reader === actor()) options.linked(result);
	});
	const follower = freshFollower(
		() => closed,
		() => {
			void stored();
			void linked();
		}
	);
	return {
		read() {
			void stored();
			void linked();
		},
		async send(message) {
			const mine = !closed && linkedHome && linkedHome.actor === actor();
			const receipt =
				(mine ? await linkedHome?.service.chat(message) : null) ??
				(await api.send<HomeChatReceipt>('POST', '/api/hub-home/chat', message));
			if (message.kind !== 'note' && ['sent', 'queued'].includes(receipt.status)) follower.start();
			if (message.kind === 'answer') follower.read();
			return receipt;
		},
		readDocument: homeDocumentReader(
			options,
			() => linkedHome,
			() => closed
		),
		computers: () => void linked(),
		close() {
			closed = true;
			follower.stop();
			linkedHome?.service.close();
			linkedHome = undefined;
		}
	};
}
