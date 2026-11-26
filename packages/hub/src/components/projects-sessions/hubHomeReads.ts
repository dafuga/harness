// @harness-uid u_evpsejqo7k
import type { HomeChatReceipt } from '../../../../reports/src/lib/projects-sessions/hub-home/hubHome.types';
import { coalesced } from '$reports/lib/projects-sessions/realtime/coalesced';
import { LinkedHomeService } from '../../services/networking-security/LinkedHomeService';
import { readHome } from './hubHomeClient';
import type { HubHomeReadOptions, HubHomeReads } from './hubHomeReads.types';
export type { HubHomeReadOptions, HubHomeReads } from './hubHomeReads.types';

/**
 * What a change notice reads again: the published Home and the linked computers. Each has one
 * flight at a time, so a burst of notices cannot discard every answer before it lands.
 */
export function hubHomeReads(options: HubHomeReadOptions): HubHomeReads {
	const { api, actor } = options;
	let linkedHome: { actor: string; service: LinkedHomeService } | undefined;
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
	return {
		read() {
			void stored();
			void linked();
		},
		async send(message) {
			const mine = !closed && linkedHome && linkedHome.actor === actor();
			return (
				(mine ? await linkedHome?.service.chat(message) : null) ??
				api.send<HomeChatReceipt>('POST', '/api/hub-home/chat', message)
			);
		},
		close() {
			closed = true;
			linkedHome?.service.close();
			linkedHome = undefined;
		}
	};
}
