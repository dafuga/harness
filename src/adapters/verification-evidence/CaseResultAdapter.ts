import { appendFileSync, mkdirSync, realpathSync } from 'node:fs';
import { join, relative } from 'node:path';
import { caseOutcomeSchema } from '../../core/verification-evidence/caseOutcomeSchema';
import type {
	CaseResultAdapterConfig,
	RunnerTask,
	BrowserCase,
	BrowserResult
} from './CaseResultAdapter.types';

const runnerStatus: Record<string, 'passed' | 'skipped' | undefined> = {
	pass: 'passed',
	passed: 'passed',
	skip: 'skipped',
	skipped: 'skipped',
	todo: 'skipped'
};

/** Runner reporter: records observations, never changes authored expectations or baselines. */
export class CaseResultAdapter {
	constructor(private readonly config: CaseResultAdapterConfig = {}) {}

	onFinished(files: RunnerTask[]): void {
		for (const file of files) this.tasks(file.tasks ?? [], file.filepath ?? '', []);
	}
	onTestEnd(test: BrowserCase, result: BrowserResult): void {
		this.write(
			test.location.file,
			test.titlePath().slice(2).join(' > '),
			result.status,
			result.retry
		);
	}
	private tasks(tasks: RunnerTask[], file: string, titles: string[]): void {
		for (const task of tasks) {
			const path = [...titles, task.name];
			if (task.type === 'suite') this.tasks(task.tasks ?? [], file, path);
			else {
				const retries = task.result?.retryCount ?? 0;
				for (let retry = 0; retry < retries; retry++)
					this.write(file, path.join(' > '), 'failed', retry);
				this.write(file, path.join(' > '), task.result?.state ?? task.mode ?? 'skip', retries);
			}
		}
	}
	private write(file: string, title: string, status: string, retry: number): void {
		const root = this.config.root ?? process.env.HARNESS_VERIFY_CASE_ROOT;
		const directory = this.config.directory ?? process.env.HARNESS_EVIDENCE_DIR;
		const revision = this.config.revision ?? process.env.HARNESS_VERIFY_REVISION;
		if (!root || !directory || !revision) return;
		const path = casePath(root, file);
		// Nested disposable fixture projects have their own tests, outside this tested source tree.
		if (path === '..' || path.startsWith('../')) return;
		const outcome = caseOutcomeSchema.parse({
			file: path,
			title,
			revision,
			retry,
			status: runnerStatus[status] ?? 'failed'
		});
		mkdirSync(directory, { recursive: true });
		appendFileSync(join(directory, 'case-results.ndjson'), `${JSON.stringify(outcome)}\n`);
	}
}

/** Runner paths may be canonical even when the snapshot root is a symlink. */
function casePath(root: string, file: string): string {
	try {
		return relative(realpathSync(root), realpathSync(file)).replaceAll('\\', '/');
	} catch (error) {
		const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined;
		if (code !== 'ENOENT' && code !== 'ENOTDIR') throw error;
		return relative(root, file).replaceAll('\\', '/');
	}
}

export type { CaseResultAdapterConfig } from './CaseResultAdapter.types';
export default CaseResultAdapter;
