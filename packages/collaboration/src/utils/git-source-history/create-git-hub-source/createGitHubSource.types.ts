import type { GitHubOptions } from '../../../models/planning-collaboration/Collaboration.types';

export type Options = Omit<GitHubOptions, 'repository'>;
