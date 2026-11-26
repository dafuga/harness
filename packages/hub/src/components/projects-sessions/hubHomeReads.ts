// @harness-uid u_evpsejqo7k
import { coalesced } from '$reports/lib/projects-sessions/realtime/coalesced';
import {
	LinkedHomeService,
	type LinkedHome
} from '../../services/networking-security/LinkedHomeService';
import { readHome } from './hubHomeClient';
import type { BrowserApi } from '../../utils/browserApi';
import type { ReadHomeResult } from './hubHomeView.types';

/**
 * What a change notice reads again: the published Home and the linked computers. Each has one
 * flight at a time, so a burst of notices cannot discard every answer before it lands.
 */
export function hubHomeReads(options: {
	api: BrowserApi;
	actor: () => string | undefined;
	home: (result: ReadHomeResult) => void;
	linked: (result: LinkedHome) => void;
}) {
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
		close() {
			closed = true;
			linkedHome?.service.close();
			linkedHome = undefined;
		}
	};
}
