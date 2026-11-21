// @harness-uid u_zxcs33stsc
import { readProjectOverview } from '../../packages/reports/src/lib/projects-sessions/project-overview/readProjectOverview';
import type { ProjectList } from './projects.types';

export type { ProjectList, ProjectListRow } from './projects.types';

const DISPLAY_NAME = /^[a-zA-Z0-9][a-zA-Z0-9 _.&-]{0,79}$/;

/** Read the local tracker through Project Overview and return the aggregate card data. */
export async function readProjectList(
	fetcher: typeof fetch = globalThis.fetch,
	now: number = Date.now()
): Promise<ProjectList> {
	const snapshot = await readProjectOverview(fetcher, now);
	if (snapshot.status === 'unavailable') return { schema: 1, status: 'unavailable', projects: [] };

	const projects = snapshot.projects
		.filter(({ agent }) => DISPLAY_NAME.test(agent))
		.map(({ agent, state, counts }) => ({ id: agent, title: agent, state, counts }));
	return projects.length
		? { schema: 1, status: 'ready', projects }
		: { schema: 1, status: 'empty', projects: [] };
}
