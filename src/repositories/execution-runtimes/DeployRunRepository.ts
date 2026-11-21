// @harness-uid u_wpvhgcfqx5
// @harness-uid u_dkv7p92mfc
import { ExpectedCliError } from '../../core/development-tooling/errors';
import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
	digest,
	journal,
	name,
	environment,
	runId,
	release,
	type Journal,
	type Release
} from '../../core/execution-runtimes/scripted-deploy/contracts';

export class DeployRunRepository {
	constructor(readonly root: string) {
		mkdirSync(root, { recursive: true, mode: 0o700 });
		const info = statSync(root);
		if (!info.isDirectory() || info.uid !== process.getuid?.() || (info.mode & 0o077) !== 0) {
			throw new ExpectedCliError('Deployment state must be an owner-only directory.');
		}
	}

	artifact(id: string): string {
		return join(this.releaseDirectory(id), 'artifact.tar');
	}

	releaseDirectory(id: string): string {
		return join(this.root, 'releases', digest.parse(id));
	}

	getRelease(id: string): Release {
		return release.parse(read(join(this.releaseDirectory(id), 'release.json')));
	}

	get(id: string): Journal {
		return journal.parse(read(this.runFile(id)));
	}

	save(record: Journal): void {
		const path = this.runFile(record.plan.id);
		mkdirSync(join(this.root, 'runs'), { recursive: true, mode: 0o700 });
		atomicWrite(path, journal.parse(record));
	}

	lock(project: string, target: string, id: string): void {
		const path = this.claimFile(project, target);
		mkdirSync(join(this.root, 'claims'), { recursive: true, mode: 0o700 });
		try {
			writeFileSync(path, runId.parse(id), { flag: 'wx', mode: 0o600 });
		} catch (error) {
			if ((error as { code?: string }).code !== 'EEXIST') throw error;
			throw new ExpectedCliError(
				'Target already has an active or unresolved run: ' + this.active(project, target)
			);
		}
	}

	active(project: string, target: string): string | null {
		try {
			return runId.parse(readFileSync(this.claimFile(project, target), 'utf8'));
		} catch (error) {
			if ((error as { code?: string }).code !== 'ENOENT') throw error;
			return null;
		}
	}

	unlock(record: Journal): void {
		const { project, environment: target, id } = record.plan;
		if (this.active(project, target) !== id)
			throw new ExpectedCliError('Deployment claim ownership changed.');
		rmSync(this.claimFile(project, target));
	}

	private claimFile(project: string, target: string): string {
		return join(this.root, 'claims', name.parse(project) + '-' + environment.parse(target));
	}

	private runFile(id: string): string {
		return join(this.root, 'runs', runId.parse(id) + '.json');
	}
}

export function atomicWrite(path: string, input: Journal | Release): void {
	const temporary = path + '.' + randomUUID();
	writeFileSync(temporary, JSON.stringify(input, null, 2) + '\n', {
		mode: 0o600,
		flag: 'wx',
		flush: true
	});
	try {
		renameSync(temporary, path);
	} finally {
		rmSync(temporary, { force: true });
	}
}

function read(file: string): unknown {
	return JSON.parse(readFileSync(file, 'utf8')) as unknown;
}
