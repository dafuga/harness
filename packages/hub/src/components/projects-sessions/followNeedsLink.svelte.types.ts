// @harness-uid u_edh24hc4bb
import type { HomeOpenAsk } from '$reports/lib/projects-sessions/hub-home/hubHome.types';
import type { OpenHomeCosAsk } from '../../../../reports/src/components/projects-sessions/hub-home/hubHomeChatContext.types';

/** What following a notification needs of Home, as it stands when asked. */
export interface NeedsLinkHome {
	asks: readonly HomeOpenAsk[];
	openAsk: OpenHomeCosAsk;
	/** Closes the open dialog, when there is one, before the list is shown. */
	close: () => void;
	dialog: boolean;
	/** Reads Home again after a click reaches an open tab. */
	reload: () => void;
}
