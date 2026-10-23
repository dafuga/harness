import type { ProjectData } from './ui-project-data';

export type Input = Record<string, unknown> & { projectId?: string; commit?: string | null };

export type Project = ProjectData['projects'][number];

export interface Host {
	harness: Record<string, unknown>;
	__calls: Input[];
	__outbox: (op: 'save' | 'list', value?: unknown) => Promise<Record<string, unknown>[]>;
	__projects: {
		data: ProjectData;
		selected: string | null;
		delay: Record<string, number>;
		/** Like the main process: an operation for a project that is not selected is refused. */
		own: (op: string, input?: Input) => Project;
		snapshot: (project: Project, commit?: string | null) => unknown;
	};
}
