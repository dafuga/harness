import type { OverviewCard } from '../../packages/reports/src/lib/projects-sessions/project-overview/projectOverview.types';

export interface ProjectListRow {
	id: string;
	title: string;
	state: OverviewCard['state'];
	counts: OverviewCard['counts'];
}

export type ProjectList =
	| { schema: 1; status: 'ready'; projects: ProjectListRow[] }
	| { schema: 1; status: 'empty' | 'unavailable'; projects: [] };
