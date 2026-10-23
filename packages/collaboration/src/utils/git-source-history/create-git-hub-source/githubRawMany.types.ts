import type { SourceAdapter } from '../../../models/planning-collaboration/Collaboration.types';
import type { GitHubOptions } from '../../../models/planning-collaboration/Collaboration.types';
import type { RepositoryIdentity } from '../../../models/planning-collaboration/Collaboration.types';

export interface Context {
	adapter: SourceAdapter;
	options: Omit<GitHubOptions, 'repository'>;
	cache: Map<string, Promise<Uint8Array>>;
	key(repo: RepositoryIdentity, ref: string): string;
}
