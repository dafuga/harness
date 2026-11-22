import type { ProjectActivityService } from '../../src/services/projects-sessions/project-activity-service/ProjectActivityService';

export type Repository = { root: string; git: (...args: string[]) => string };

export type History = Parameters<ProjectActivityService['recorded']>[0];

export type Details = Parameters<ProjectActivityService['recorded']>[1];
