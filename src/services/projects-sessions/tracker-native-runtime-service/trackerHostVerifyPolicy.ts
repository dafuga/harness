// @harness-uid u_bl6xl2h4a3
import type { RouteSet } from './trackerHostVerifyPolicy.types';

/**
 * A verify command runs on the host. Docker workers' worktrees must not run there, so only macOS
 * routes may declare one, and routes sharing a checkout must agree because runs record the checkout.
 */
export const hostVerify = [
	({ repositories }: RouteSet) => {
		const commands = new Map<string, string | undefined>();
		return Object.values(repositories).every(({ repo, platform, verify }) => {
			const agrees = !commands.has(repo) || commands.get(repo) === verify;
			commands.set(repo, verify);
			return agrees && (!verify || platform === 'macos');
		});
	},
	'verify needs a macOS route, with one command for each repository'
] as const;

export const noVerify = [
	({ repositories }: RouteSet) => Object.values(repositories).every(({ verify }) => !verify),
	'verify needs the managed Tracker launcher'
] as const;
