// @harness-uid u_jlfurqdczj
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { constants } from 'node:os';
import { clearInterval, setInterval } from 'node:timers';
import { setTimeout as delay } from 'node:timers/promises';
import { trackerHostWork } from '../../../utils/projects-sessions/trackerHostWork';
import type { TrackerNodeConfig } from '../../../services/projects-sessions/tracker-node-service/trackerNodeConfig.types';
import type { TrackerHostWorkClaim } from '../../../repositories/projects-sessions/TrackerHostWorkRepository.types';
import type { TrackerPlacement } from '../../../utils/projects-sessions/trackerMachine.types';
import { trackerFleetNodes } from '../../../services/agents-providers/tracker-dispatcher-service/launchEligibility';
import { fetchNativeTracker } from './fetchNativeTracker';

export async function runTrackerHostWork(
	args: string[],
	config: TrackerNodeConfig
): Promise<number> {
	const [kind, requestedHost, ...command] = args;
	if (command[0] === '--') command.shift();
	try {
		if (kind === 'ssh' && requestedHost === 'auto' && command.length) {
			const routed = await chooseHeavyTestHost(config, command);
			if (routed.host === config.node) return await runCommand(routed.argv, async () => {});
			return await runTrackedHostWork(config, kind, routed.host, routed.argv);
		}
		return await runTrackedHostWork(config, kind, requestedHost, command);
	} catch (error) {
		const message = error instanceof Error ? error.message : 'host work unavailable';
		console.error(`tracker: ${message}`);
		return 1;
	}
}

async function runTrackedHostWork(
	config: TrackerNodeConfig,
	kind: string,
	host: string,
	command: string[]
): Promise<number> {
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
	await update('POST');
	try {
		return await runCommand(command, () => update('POST'));
	} finally {
		await update('DELETE').catch(() => {
			console.error('tracker: could not release host work. The lease will expire.');
		});
	}
}

async function chooseHeavyTestHost(config: TrackerNodeConfig, command: string[]) {
	if (!(Number(process.env.TRACKER_RUN_ID) > 0))
		throw new Error('Run this inside a managed session.');
	const { host, placement } = await waitForHeavyTestHost(config);
	const cpus = String(Math.max(1, Math.ceil(placement.needs_cores)));
	const memory = String(Math.max(512, Math.ceil(placement.needs_ram_gb * 1024)));
	const argv = [
		'harness',
		'resources',
		'run',
		'--heavy-test',
		'--cpus',
		cpus,
		'--memory-mib',
		memory,
		'--',
		...command
	];
	if (host === config.node) return { host, argv };
	const remote = argv.map((arg) => "'" + arg.replaceAll("'", "'\\''") + "'").join(' ');
	return { host, argv: [...sshBatch, '--', host, remote] };
}

const sshBatch = ['ssh', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=5'];

async function waitForHeavyTestHost(config: TrackerNodeConfig) {
	const wait = AbortSignal.timeout(30 * 60_000);
	let announced = false;
	while (true) {
		const placement = await readHeavyTestPlacement(config);
		const candidates = placement.ranked.filter(
			(row) => row.fits && row.role !== 'shared' && trackerFleetNodes.includes(row.node)
		);
		for (const { node } of candidates) {
			if (
				node === config.node ||
				(await runCommand([...sshBatch, '--', node, '/usr/bin/true'], async () => {})) === 0
			)
				return { host: node, placement };
		}
		if (candidates.length) throw new Error('Eligible test computers are unreachable over SSH.');
		if (!announced) console.error('Waiting for a Mac with CPU and RAM for a heavy test lane.');
		announced = true;
		await delay(5000, undefined, { signal: wait });
	}
}

async function readHeavyTestPlacement(config: TrackerNodeConfig): Promise<TrackerPlacement> {
	const response = await fetchNativeTracker(
		config,
		{ method: 'GET', path: '/place?kind=build' },
		`tracker-run-${process.env.TRACKER_RUN_ID}@${config.node}`
	);
	if (!response.ok) throw new Error(`Heavy test placement failed (HTTP ${response.status}).`);
	const placement = (await response.json()) as TrackerPlacement;
	if (!(placement.needs_cores > 0 && placement.needs_ram_gb > 0 && Array.isArray(placement.ranked)))
		throw new Error('This Tracker service did not provide a CPU and RAM estimate.');
	return placement;
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
