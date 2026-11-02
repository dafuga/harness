// @harness-uid u_l7uc3o4sg7
import type { GitHubOptions } from '../../../models/planning-collaboration/Collaboration.types';

export type Options = Omit<GitHubOptions, 'repository'>;
