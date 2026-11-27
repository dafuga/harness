import type { projectList } from '../../src/components/projects-sessions/project-switcher/projectList';
import type { listedProjects } from '../../src/utils/projects-sessions/projectList';

export type Projects = Parameters<typeof projectList>[0];

export type Snapshot = NonNullable<Parameters<typeof projectList>[1]>;

export type Bridge = Parameters<typeof listedProjects>[0];
