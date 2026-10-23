import type { ProjectContext } from '../../../models/projects-sessions/ProjectContext.types';

export type Guard = <T>(context: ProjectContext, read: (base: string) => Promise<T>) => Promise<T>;
