import { getContext, setContext } from 'svelte';
import { createSessionStore, type Session } from '../lib/stores/session.svelte';
import { browserApi, type BrowserApi } from './browserApi';
import { browserAuth } from './browserAuth';
import { browserProjects, type BrowserProjects } from './browserProjects';

export interface HostedBrowser {
	api: BrowserApi;
	session: Session;
	projects: BrowserProjects;
}
const key = Symbol('hosted browser');

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

/** The API client, session and project calls of the page a component is rendered in. */
export function browserContext(): HostedBrowser {
	return getContext<HostedBrowser>(key);
}
