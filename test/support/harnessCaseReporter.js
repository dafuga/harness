import { appendFileSync, mkdirSync, realpathSync } from 'node:fs';
import { join, relative } from 'node:path';

export default class HarnessCaseReporter {
	onTestEnd(test, result) {
		this.write(
			test.location.file,
			test.titlePath().slice(3).join(' > '),
			result.status,
			result.retry
		);
	}
	onFinished(files) {
		for (const file of files) this.tasks(file.tasks ?? [], file.filepath ?? '', []);
	}
	tasks(tasks, file, titles) {
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
	write(file, title, state, retry) {
		const {
			HARNESS_VERIFY_CASE_ROOT: root,
			HARNESS_EVIDENCE_DIR: directory,
			HARNESS_VERIFY_REVISION: revision
		} = process.env;
		if (!root || !directory || !revision) return;
		const path = casePath(root, file);
		if (path === '..' || path.startsWith('../')) return;
		if (
			!/^[a-f0-9]{40}$/.test(revision) ||
			!path ||
			!title ||
			!Number.isInteger(retry) ||
			retry < 0
		)
			throw new Error('Invalid case outcome');
		const status = ['pass', 'passed'].includes(state)
			? 'passed'
			: ['skip', 'skipped', 'todo'].includes(state)
				? 'skipped'
				: 'failed';
		mkdirSync(directory, { recursive: true });
		appendFileSync(
			join(directory, 'case-results.ndjson'),
			JSON.stringify({ file: path, title, revision, retry, status }) + '\n'
		);
	}
}

function casePath(root, file) {
	try {
		return relative(realpathSync(root), realpathSync(file)).replaceAll('\\', '/');
	} catch (error) {
		if (!['ENOENT', 'ENOTDIR'].includes(error?.code)) throw error;
		return relative(root, file).replaceAll('\\', '/');
	}
}
