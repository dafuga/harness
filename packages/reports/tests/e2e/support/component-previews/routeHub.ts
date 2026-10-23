import { openRoute, page } from './router.svelte';
import type { PreviewProps } from './shared';

/** URL/parameter bindings for the actual Hub page modules over their existing component fixtures. */
export function hubRoute(
	id: string,
	hostedAddress: string,
	projectId: string
): PreviewProps | undefined {
	const project = encodeURIComponent(projectId);
	const routes: Record<string, { route: string; path: string }> = {
		'hub.layout.root': { route: '/', path: '/' },
		'hub.page.root': { route: '/', path: '/' },
		'hub.page.projects-project-id-harness-path': {
			route: '/projects/[projectId]/harness/[...path]',
			path: hostedAddress
		},
		'hub.page.projects-project-id-members': {
			route: '/projects/[projectId]/members',
			path: `/projects/${project}/members`
		},
		'hub.page.invite-project-id-invitation-id': {
			route: '/invite/[projectId]/[invitationId]',
			path: `/invite/${project}/preview-invitation`
		},
		'hub.page.native-handoff-id': {
			route: '/native/[handoffId]',
			path: '/native/preview-request'
		}
	};
	const shown = routes[id];
	if (!shown) return undefined;
	openRoute(shown.route, shown.path);
	return { data: {}, form: null, params: { ...page.params } };
}
