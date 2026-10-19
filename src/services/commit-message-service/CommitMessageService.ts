import { readFile } from 'node:fs/promises';
import { GitAdapter } from '../../adapters/GitAdapter';
import { evidenceMarker } from '../../core/historyTypes';
import { verifyConfigFile } from '../../core/verifyTypes';
import { commitMessage, writtenMessage } from './commitMessage';
import { writingDeclared } from './writingLimits';

/**
 * Measures commit messages of one repository against the writing limits. A message is held to
 * them only where the tree it is committed with declares them, so what was written before a
 * repository adopted the limits stays valid, and a commit of evidence is never a message about
 * source.
 */
export class CommitMessageService {
	private readonly git: GitAdapter;

	constructor(root: string) {
		this.git = new GitAdapter(root);
	}

	/**
	 * What is wrong with the message a commit is about to get, read from the file Git gives a
	 * commit-msg hook. What is being committed is the index, so that is where the limits are read.
	 * Git tells its hooks that no editor is opened by setting GIT_EDITOR to a colon. A cleanup
	 * mode given on the command line is not told to a hook; the stored message is measured again.
	 */
	async written(file: string, edited = process.env.GIT_EDITOR !== ':'): Promise<string[]> {
		if (!(await this.held(':'))) return [];
		const [configured, comment] = await Promise.all(
			['commit.cleanup', 'core.commentChar'].map((name) => this.git.attempt(['config', name]))
		);
		// Without a mode of its own Git strips comments from a message it opened an editor for,
		// and keeps every line of one it did not: there a line that starts with a hash is content.
		const usual = edited ? 'strip' : 'whitespace';
		const text = await readFile(file, 'utf8');
		return commitMessage(
			writtenMessage(text, {
				cleanup: !configured || configured === 'default' ? usual : configured,
				comment: comment && comment !== 'auto' ? comment : '#'
			})
		);
	}

	/**
	 * What is wrong with the stored messages of the source commits that `head` has and `base`
	 * has not, each named by its commit: every commit a merge brings in, not only its first
	 * parents. Without a base every ancestor that declares the limits is measured.
	 */
	async stored(base: string | null | undefined, head: string): Promise<string[]> {
		const range = base ? `${base}..${head}` : head;
		const listed = await this.git.run(['rev-list', '--topo-order', '--reverse', range]);
		const problems: string[] = [];
		for (const commit of listed.split('\n').filter(Boolean)) {
			if (!(await this.held(`${commit}:`))) continue;
			const message = await this.git.run(['log', '-1', '--format=%B', commit]);
			for (const problem of commitMessage(message))
				problems.push(`commit ${commit.slice(0, 12)}: ${problem}`);
		}
		return problems;
	}

	/** A report of a range with the problems of its stored commit messages added to its failures. */
	async reported<Report extends { failures: string[] }>(
		report: Report,
		base: string | null | undefined,
		head: string
	): Promise<Report> {
		return { ...report, failures: [...report.failures, ...(await this.stored(base, head))] };
	}

	/** Whether what is at `tree` (a commit followed by a colon, or the index) is source held to the limits. */
	private async held(tree: string): Promise<boolean> {
		if ((await this.git.attempt(['cat-file', '-e', `${tree}${evidenceMarker}`])) !== undefined)
			return false;
		return writingDeclared(await this.git.attempt(['show', `${tree}${verifyConfigFile}`]));
	}
}
