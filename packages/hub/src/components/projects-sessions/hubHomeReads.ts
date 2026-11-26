// @harness-uid u_evpsejqo7k
import type { HomeChatReceipt } from '$reports/lib/projects-sessions/hub-home/hubHome.types';
import { coalesced } from '$reports/lib/projects-sessions/realtime/coalesced';
import { LinkedHomeService } from '../../services/networking-security/LinkedHomeService';
import { readHome } from './hubHomeClient';
import type { HubHomeReadOptions, HubHomeReads } from './hubHomeReads.types';
export type { HubHomeReadOptions, HubHomeReads } from './hubHomeReads.types';

const followMs = 5 * 60_000;
const followEveryMs = 3000;

/**
 * What a change notice reads again: the published Home and the linked computers. Each has one
 * flight at a time, so a burst of notices cannot discard every answer before it lands.
 */
export function hubHomeReads(options: HubHomeReadOptions): HubHomeReads {
	const { api, actor } = options;
	let linkedHome: { actor: string; service: LinkedHomeService } | undefined;
	let closed = false;
	let followUntil = 0;
	let follower: ReturnType<typeof setInterval> | undefined;
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
	/** While a message is fresh, its receipt and reply are read every few seconds. */
	function follow() {
		followUntil = performance.now() + followMs;
		follower ??= setInterval(() => {
			if (closed || performance.now() > followUntil) {
				clearInterval(follower);
				follower = undefined;
			} else {
				void stored();
				void linked();
			}
		}, followEveryMs);
	}
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
			if (message.kind === 'message' && ['sent', 'queued'].includes(receipt.status)) follow();
			return receipt;
		},
		computers() {
			void linked();
		},
		close() {
			closed = true;
			clearInterval(follower);
			linkedHome?.service.close();
			linkedHome = undefined;
		}
	};
}
