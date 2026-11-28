// @harness-uid u_pa2kr3prra
import type { TrackerGithubCommentAdapterConfig } from './TrackerGithubCommentAdapter.types';

export class TrackerGithubCommentAdapter {
	constructor(private readonly config: TrackerGithubCommentAdapterConfig = {}) {}

	connect(): string {
		return this.config.name ?? 'tracker-github-comment';
	}
}

export type { TrackerGithubCommentAdapterConfig } from './TrackerGithubCommentAdapter.types';
