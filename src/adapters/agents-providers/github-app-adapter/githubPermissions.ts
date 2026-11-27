// @harness-uid u_kg5hqc4klm
import type { GitHubTokenScope } from '../GitHubAppAdapter.types';

/** Least privilege per scope: reads never carry issue-write, and nothing carries contents-write. */
export const githubPermissions: Readonly<Record<GitHubTokenScope, Record<string, string>>> = {
	read: {
		metadata: 'read',
		issues: 'read',
		contents: 'read',
		pull_requests: 'read',
		actions: 'read',
		checks: 'read'
	},
	issues: { metadata: 'read', issues: 'write' }
};

const repoName = /^[A-Za-z0-9_.-]{1,100}$/;

export function validRepoPart(value: string): boolean {
	return repoName.test(value) && value !== '.' && value !== '..';
}
