import { getContext } from 'svelte';
import { type Session } from '../lib/stores/session.svelte';
import { type BrowserApi } from './browserApi';
import { type BrowserProjects } from './browserProjects';

export interface HostedBrowser {
	api: BrowserApi;
	session: Session;
	projects: BrowserProjects;
}

export const key = Symbol('hosted browser');

/** The API client, session and project calls of the page a component is rendered in. */
export function browserContext(): HostedBrowser {
	return getContext<HostedBrowser>(key);
}

export { provideBrowser } from '../routes/browserContext';
