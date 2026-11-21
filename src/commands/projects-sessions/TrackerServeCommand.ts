// @harness-uid u_fqfcxer6ml
import { parseArgs } from 'node:util';
import { TrackerNodeService } from '../../services/projects-sessions/TrackerNodeService';
import type { TrackerNodeOwner } from '../../services/projects-sessions/TrackerNodeService.types';
import { loadTrackerNodeConfig } from '../../services/projects-sessions/tracker-node-service/trackerNodeConfig';

const usage = 'Usage: harness tracker serve --config <private absolute path> --role hub|spoke';

export class TrackerServeCommand {
	async run(args: string[]): Promise<number> {
		const input = parseServeArgs(args);
		if (!input) {
			console.error(usage);
			return 2;
		}
		if (input.help) {
			console.log(usage);
			return 0;
		}
		const config = loadSelectedRole(input.config, input.role);
		if (!config) return 2;
		const stop = new AbortController();
		const onSignal = () => stop.abort();
		process.once('SIGINT', onSignal);
		process.once('SIGTERM', onSignal);
		try {
			const owner = await new TrackerNodeService().start(config);
			await superviseTrackerNode(owner, stop.signal);
			return 0;
		} catch {
			console.error('tracker: native service startup, drain, or rollback check failed');
			return 1;
		} finally {
			process.removeListener('SIGINT', onSignal);
			process.removeListener('SIGTERM', onSignal);
		}
	}
}

function parseServeArgs(args: string[]) {
	try {
		const { values } = parseArgs({
			args,
			options: {
				config: { type: 'string' },
				role: { type: 'string' },
				help: { type: 'boolean', short: 'h' }
			}
		});
		if (values.help) return { help: true as const };
		const { config, role } = values;
		if (!config || (role !== 'hub' && role !== 'spoke')) return null;
		return {
			help: false as const,
			config,
			role: role === 'hub' ? ('hub' as const) : ('spoke' as const)
		};
	} catch {
		return null;
	}
}

function loadSelectedRole(path: string, role: 'hub' | 'spoke') {
	try {
		const config = loadTrackerNodeConfig(path);
		if (config.role !== role) throw new TypeError('Tracker role mismatch');
		return config;
	} catch {
		console.error('tracker: invalid or unreadable native configuration, or role mismatch');
		return null;
	}
}

async function superviseTrackerNode(owner: TrackerNodeOwner, signal: AbortSignal): Promise<void> {
	const { node, pid, port, syncPort, checkpoint } = owner;
	const stop = new Promise<void>((resolve) => {
		if (signal.aborted) resolve();
		else signal.addEventListener('abort', () => resolve(), { once: true });
	});
	try {
		console.log(JSON.stringify({ node, pid, port, syncPort, checkpoint }));
		await Promise.race([stop, owner.workers.then(() => stop)]);
	} finally {
		await owner.close();
	}
}
