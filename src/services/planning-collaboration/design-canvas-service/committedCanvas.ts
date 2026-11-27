// @harness-uid u_kggn23yn3a
import { execFileSync } from 'node:child_process';
import { DesignCanvasError } from '../../../../packages/reports/src/models/planning-collaboration/DesignCanvasError';

/** Where reviewers can read this canvas: it must be committed, and the commit on GitHub. */
export function committedCanvas(root: string, folder: string) {
	const git = (...args: string[]) =>
		execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
	if (git('status', '--porcelain', '--', folder))
		throw new DesignCanvasError(`Commit ${folder} before attaching it.`);
	const commit = git('rev-parse', 'HEAD');
	if (!git('branch', '-r', '--contains', commit))
		throw new DesignCanvasError('Push this commit before attaching it.');
	const repository = githubRepository(git('remote', 'get-url', 'origin'));
	return { commit, repository, branch: git('rev-parse', '--abbrev-ref', 'HEAD') };
}

/** The web address of a GitHub remote; a remote with credentials in it never reaches a link. */
export function githubRepository(remote: string): string {
	const match = /github\.com[:/]([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/.exec(remote);
	if (!match) throw new DesignCanvasError('origin is not a GitHub repository.');
	return `https://github.com/${match[1]}/${match[2]}`;
}
