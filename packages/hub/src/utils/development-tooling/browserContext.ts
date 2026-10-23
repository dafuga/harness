import type { HostedBrowser } from './browserContext.types';
import { getContext } from 'svelte';
import {} from '../../lib/stores/projects-sessions/session.svelte';
import {} from '../browserApi';
import {} from '../projects-sessions/browserProjects';

export const key = Symbol('hosted browser');

/** The API client, session and project calls of the page a component is rendered in. */
export function browserContext(): HostedBrowser {
	return getContext<HostedBrowser>(key);
}

export { provideBrowser } from '../../routes/browserContext';

export type { HostedBrowser } from './browserContext.types';
