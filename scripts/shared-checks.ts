// @harness-uid u_sbz3zzk4fx
import { ExpectedCliError } from '../src/core/errors';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { getPriority, homedir, setPriority } from 'node:os';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import {
	checkCommit,
	checkGit,
	checkRepository,
	pinCandidate,
	unpinCandidate
} from './shared-checks/checkGit';
import { CheckQueue } from './shared-checks/checkQueue';
import { workCheckQueue } from './shared-checks/checkWorker';
import type { CheckCliDependencies, CheckRequest } from './shared-checks/sharedCheck.types';

const usage =
	'bun run check [--commit SHA] [--item ID] [--priority urgent|normal|low] [--release] [--exact] [--json]';
const queueHome = join(homedir(), '.local', 'state', 'harness', 'shared-checks');

export async function runSharedChecks(
	deps: CheckCliDependencies = { home: queueHome, note: trackerNote }
): Promise<number> {
	const args = process.argv.slice(2);
	if (args[0] === '--part') return runCiPart(args);
	const { values } = parseArgs({
		args,
		options: {
			commit: { type: 'string' },
			item: { type: 'string' },
			release: { type: 'boolean' },
			exact: { type: 'boolean' },
			priority: { type: 'string' },
			json: { type: 'boolean' },
			help: { type: 'boolean' },
			serve: { type: 'boolean' },
			'ci-base': { type: 'string' }
		}
	});
	if (values['ci-base'] && process.env.GITHUB_ACTIONS !== 'true')
		throw new ExpectedCliError('Only GitHub Actions can submit a hosted check base.');
	if (values.help) {
		console.log(`${usage}\nRun the foreground host worker with bun run check --serve.`);
		return 0;
	}
	const queue = new CheckQueue(deps.home);
	const abort = new AbortController();
	const stop = () => abort.abort();
	process.on('SIGTERM', stop);
	process.on('SIGINT', stop);
	try {
		const request = values.serve ? undefined : submit(queue, values);
		const { executeCandidate } = await import('./shared-checks/checkExecution');
		setPriority(Math.max(10, getPriority()));
		while (!abort.signal.aborted) {
			await workCheckQueue(queue, {
				run: (candidate, release) => executeCandidate(queue, candidate, release, abort.signal),
				note: deps.note,
				signal: abort.signal
			});
			const result = request && queue.result(request.id);
			if (result) {
				if (values.json)
					console.log(JSON.stringify({ schemaVersion: 1, ...result, commit: request!.commit }));
				else console.log(JSON.stringify(result, null, 2));
				return result.status === 'passed' ? 0 : 1;
			}
			await Bun.sleep(500);
		}
		return 130;
	} finally {
		queue.close();
	}
}

function submit(
	queue: CheckQueue,
	values: {
		commit?: string;
		item?: string;
		priority?: string;
		release?: boolean;
		exact?: boolean;
		'ci-base'?: string;
	}
): CheckRequest {
	const repo = checkRepository(process.cwd());
	const item = values.item ?? process.env.TRACKER_ITEM_ID;
	if (item && !/^[a-z0-9]{6,12}$/.test(item))
		throw new ExpectedCliError('Expected a Tracker item ID.');
	const priority = values.priority ?? (values.release ? 'urgent' : 'normal');
	if (priority !== 'urgent' && priority !== 'normal' && priority !== 'low')
		throw new ExpectedCliError('Expected urgent, normal, or low check priority.');
	if (
		!values.commit &&
		checkGit(process.cwd(), ['status', '--porcelain', '--untracked-files=normal'])
	)
		throw new ExpectedCliError(
			'Commit the changes before submitting, or use --commit to select a committed snapshot.'
		);
	const request: CheckRequest = {
		id: randomUUID(),
		repo,
		commit: checkCommit(process.cwd(), values.commit ?? 'HEAD'),
		item,
		base: values['ci-base'] ? checkCommit(process.cwd(), values['ci-base']) : undefined,
		priority,
		release: values.release ?? false,
		exact: values.exact
	};
	pinCandidate(request);
	try {
		queue.add(request);
	} catch (error) {
		unpinCandidate(request);
		throw error;
	}
	console.error(`Queued shared check ${request.id} for ${request.commit}.`);
	return request;
}

async function trackerNote(item: string, text: string): Promise<void> {
	const local = join(homedir(), '.local', 'bin', 'tracker');
	const child = Bun.spawn([existsSync(local) ? local : 'tracker', 'note', item, text], {
		stdin: 'ignore',
		stdout: 'ignore',
		stderr: 'ignore'
	});
	const timeout = setTimeout(() => child.kill(), 10_000);
	try {
		if ((await child.exited) !== 0) throw new ExpectedCliError('Tracker note failed.');
	} finally {
		clearTimeout(timeout);
	}
}

function runCiPart(args: string[]): number {
	if (process.env.GITHUB_ACTIONS !== 'true' || args.length !== 2)
		throw new ExpectedCliError(
			'Check partitions run in GitHub Actions. Submit a combined release with bun run check --release.'
		);
	return (
		spawnSync(
			'bun',
			['scripts/with-resources.ts', 'agent-test', '--', 'bun', 'scripts/run-checks.ts', ...args],
			{
				stdio: 'inherit'
			}
		).status ?? 1
	);
}

if (import.meta.main) {
	try {
		process.exitCode = await runSharedChecks();
	} catch (error) {
		console.error(error instanceof Error ? error.message : 'Shared check failed.');
		process.exitCode = 1;
	}
}
