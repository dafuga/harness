// @harness-uid u_zjnefnyg53
import { spawn, spawnSync } from 'node:child_process';
import { homedir } from 'node:os';
import { isAbsolute } from 'node:path';
import { parseArgs } from 'node:util';
import {
	isTrackerWorkerClient,
	trackerWorkerClientRefusal
} from '../../adapters/projects-sessions/tracker-tmux-adapter/trackerWorkerClient';
import { TrackerHostInstallService } from '../../services/projects-sessions/TrackerHostInstallService';
import type { TrackerHostInstallPorts } from '../../services/projects-sessions/TrackerHostInstallService.types';
import { loadTrackerNodeConfig } from '../../services/projects-sessions/tracker-node-service/trackerNodeConfig';
import { harnessSelfCommand } from './tracker-command/harnessSelfCommand';
import { selectedTrackerConfig } from './tracker-command/runNativeTracker';

const usage =
	'Usage: harness tracker service print|install|uninstall [--config <path>] [--executable <absolute Harness launcher>]';

const ports: TrackerHostInstallPorts = {
	run(command, args) {
		const result = spawnSync(command, args, { encoding: 'utf8', timeout: 60_000 });
		return { status: result.status, stdout: result.stdout ?? '' };
	},
	start([command, ...args]) {
		spawn(command, args, { detached: true, stdio: 'ignore' }).unref();
	}
};

export class TrackerServiceCommand {
	run(args: string[]): number {
		const input = parseServiceArgs(args);
		if (!input) {
			console.error(usage);
			return 2;
		}
		if (isTrackerWorkerClient(input.install)) {
			console.error(trackerWorkerClientRefusal);
			return 2;
		}
		try {
			const service = new TrackerHostInstallService(input.install, ports);
			const kind = TrackerHostInstallService.detect(process.platform, ports);
			const lines =
				input.action === 'print'
					? service.files(kind).map(({ path, content }) => `# ${path}\n${content}`)
					: service[input.action](kind);
			console.log(lines.join('\n'));
			return 0;
		} catch (error) {
			console.error(`tracker: ${error instanceof Error ? error.message : 'service setup failed'}`);
			return 1;
		}
	}
}

function parseServiceArgs(args: string[]) {
	try {
		const { values, positionals } = parseArgs({
			args,
			allowPositionals: true,
			options: { config: { type: 'string' }, executable: { type: 'string' } }
		});
		const action = serviceAction(positionals);
		const install = action && installInput(values);
		return action && install ? { action, install } : null;
	} catch {
		return null;
	}
}

function serviceAction([action, ...extra]: string[]): 'print' | 'install' | 'uninstall' | null {
	if (extra.length) return null;
	return action === 'print' || action === 'install' || action === 'uninstall' ? action : null;
}

function installInput(values: { config?: string; executable?: string }) {
	const config = values.config ?? selectedTrackerConfig();
	const executable = values.executable ?? compiledExecutable();
	if (!config || !isAbsolute(config) || !executable || !isAbsolute(executable)) return null;
	const { role, database } = loadTrackerNodeConfig(config);
	const uid = process.getuid?.() ?? 0;
	return { executable, config, role, database, home: homedir(), uid };
}

/** A source checkout has no single launcher, so it must be named. */
function compiledExecutable(): string | undefined {
	const self = harnessSelfCommand();
	return self.length === 1 ? self[0] : undefined;
}
