import { execFileSync } from 'node:child_process';
import { basename, resolve } from 'node:path';
import {
	repositoryIdentity,
	sameSite
} from '../../../../../src/utils/repository-identity/repositoryIdentity';

export interface ReportSite {
	/** The checkout this server is hosted for. */
	root: string;
	/** What the application is called: the directory of its primary checkout. */
	name: string;
	/** Null when the server is not hosted in a Git repository; then only its own directory is. */
	identity: string | null;
}

let site: ReportSite | undefined;

function git(directory: string, args: string[]): string | undefined {
	try {
		return execFileSync('git', ['-C', directory, ...args], {
			encoding: 'utf8',
			stdio: ['ignore', 'pipe', 'ignore']
		}).trim();
	} catch {
		return undefined;
	}
}

/**
 * The application this server is hosted for. It is fixed when the server starts, from where
 * it was started or from HARNESS_SITE_ROOT, and never from a request. What belongs to it is
 * decided by the identity of its Git repository, so a worktree or a fresh clone of the same
 * application is the same site and a directory with the same name is not.
 */
export function reportSite(): ReportSite {
	if (site) return site;
	const asked = resolve(process.env.HARNESS_SITE_ROOT?.trim() || process.cwd());
	const root = git(asked, ['rev-parse', '--show-toplevel']) ?? asked;
	const primary = git(root, ['worktree', 'list', '--porcelain'])?.split('\n')[0]?.slice(9);
	site = { root, name: basename(primary || root), identity: repositoryIdentity(root) };
	return site;
}

/** True when a report or an event was recorded in a checkout of this site's repository. */
export function ownedBySite(project: { path: string }): boolean {
	return sameSite(reportSite().root, project.path);
}
