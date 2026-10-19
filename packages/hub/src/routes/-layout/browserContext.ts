import type { HostedBrowser } from '../../utils/browserContext';
import { key } from '../../utils/browserContext';
import { setContext } from 'svelte';
import { createSessionStore } from '../../lib/stores/session.svelte';
import { browserApi } from './browserApi';
import { browserAuth } from '../../utils/browserAuth';
import { browserProjects } from './browserProjects';

/** One API client and one session per opened page, held by the layout and never by a module. */
export function provideBrowser(): HostedBrowser {
	/** A refused session is read again, so a page that lost it asks for sign-in and shows nothing. */
	const api = browserApi(fetch, (failure) => {
		if (failure.status === 401 && context.session.actor) void context.session.refresh();
	});
	const context: HostedBrowser = {
		api,
		session: createSessionStore(browserAuth(api)),
		projects: browserProjects(api)
	};
	setContext(key, context);
	return context;
}
