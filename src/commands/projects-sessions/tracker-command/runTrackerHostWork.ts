// @harness-uid u_jlfurqdczj
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { constants } from 'node:os';
import { clearInterval, setInterval } from 'node:timers';
import { trackerHostWork } from '../../../utils/projects-sessions/trackerHostWork';
import type { TrackerNodeConfig } from '../../../services/projects-sessions/tracker-node-service/trackerNodeConfig.types';
import type { TrackerHostWorkClaim } from '../../../repositories/projects-sessions/TrackerHostWorkRepository.types';
import { fetchNativeTracker } from './fetchNativeTracker';

export async function runTrackerHostWork(
	args: string[],
	config: TrackerNodeConfig
): Promise<number> {
	const [kind, host, ...command] = args;
	if (command[0] === '--') command.shift();
	const claim = trackerHostWork.claim.safeParse({
		kind,
		host,
		run: Number(process.env.TRACKER_RUN_ID),
		lease: randomUUID()
	}).data;
	if (!claim || !command[0]) {
		console.error(
			'Usage in a managed run: tracker host-work <ssh|colima> <computer> -- <command> [args...]'
		);
		return 2;
	}
	const update = (method: 'POST' | 'DELETE') => updateClaim(config, claim, method);
	try {
		await update('POST');
		try {
			return await runCommand(command, () => update('POST'));
		} finally {
			await update('DELETE').catch(() => {
				console.error('tracker: could not release host work. The lease will expire.');
			});
		}
	} catch (error) {
		const message = error instanceof Error ? error.message : 'host work unavailable';
		console.error(`tracker: ${message}`);
		return 1;
	}
}

async function updateClaim(
	config: TrackerNodeConfig,
	claim: TrackerHostWorkClaim,
	method: 'POST' | 'DELETE'
) {
	const response = await fetchNativeTracker(
		config,
		{
			method,
			path: '/host-work',
			body: { ...claim }
		},
		`tracker-run-${claim.run}@${config.node}`
	);
	await response.body?.cancel();
	if (!response.ok)
		throw new DOMException(
			`host work lease request refused (HTTP ${response.status})`,
			'OperationError'
		);
}

async function runCommand([command, ...args]: string[], renew: () => Promise<void>) {
	const child = spawn(command, args, { stdio: 'inherit' });
	let renewing: Promise<void> | undefined;
	let renewalFailed = false;
	const terminate = () => child.kill('SIGTERM');
	const interrupt = () => child.kill('SIGINT');
	const hangup = () => child.kill('SIGHUP');
	process.on('SIGTERM', terminate);
	process.on('SIGINT', interrupt);
	process.on('SIGHUP', hangup);
	const timer = setInterval(() => {
		renewing ??= renew()
			.catch(() => {
				console.error('tracker: host work lease could not be renewed.');
				renewalFailed = true;
				terminate();
			})
			.finally(() => {
				renewing = undefined;
			});
	}, trackerHostWork.renewMs);
	try {
		const status = await new Promise<number>((resolve, reject) => {
			child.once('error', reject);
			child.once('exit', (code, signal) =>
				resolve(code ?? (signal ? 128 + constants.signals[signal] : 1))
			);
		});
		return renewalFailed && status === 0 ? 1 : status;
	} finally {
		clearInterval(timer);
		process.off('SIGTERM', terminate);
		process.off('SIGINT', interrupt);
		process.off('SIGHUP', hangup);
		await renewing;
	}
}
