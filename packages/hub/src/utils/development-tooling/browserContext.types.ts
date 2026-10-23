import type { BrowserApi } from '../browserApi';
import type { Session } from '../../lib/stores/projects-sessions/session.svelte';
import type { BrowserProjects } from '../projects-sessions/browserProjects';

export interface HostedBrowser {
	api: BrowserApi;
	session: Session;
	projects: BrowserProjects;
}
