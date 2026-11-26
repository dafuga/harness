// @harness-uid u_i2zk7o2rko
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import type {
	TrackerHostInstallInput,
	TrackerHostInstallPorts
} from '../TrackerHostInstallService.types';
import { requireHostCommand, writeHostFiles } from './hostFileWrites';
import { trackerHealthAgentPlist } from './trackerHealthAgentPlist';
import type { TrackerHost } from './trackerHost.types';

const serviceLabel = 'local.harness.tracker';
const healthLabel = 'local.harness.tracker-health';

/** macOS already supervises the service; this adds the health check, which also rotates its logs. */
export const launchdTrackerHost: TrackerHost = {
	files(input, ports) {
		const content = trackerHealthAgentPlist(healthLabel, input, serviceAgent(input, ports));
		return [{ path: agentPath(input, healthLabel), content }];
	},
	install(input, ports) {
		const [file] = this.files(input, ports);
		writeHostFiles([file]);
		requireHostCommand(ports, '/usr/bin/plutil', ['-lint', file.path]);
		ports.run('/bin/launchctl', ['bootout', `gui/${input.uid}/${healthLabel}`]);
		requireHostCommand(ports, '/bin/launchctl', ['bootstrap', `gui/${input.uid}`, file.path]);
		return [
			`installed ${healthLabel}; it first runs at the next 4-hour slot`,
			`The ${serviceLabel} service agent is unchanged.`
		];
	},
	uninstall(input, ports) {
		ports.run('/bin/launchctl', ['bootout', `gui/${input.uid}/${healthLabel}`]);
		rmSync(agentPath(input, healthLabel), { force: true });
		return [`removed ${healthLabel}; the ${serviceLabel} service agent is unchanged`];
	}
};

function agentPath({ home }: TrackerHostInstallInput, label: string): string {
	return join(home, 'Library', 'LaunchAgents', `${label}.plist`);
}

/** The service agent's path and log files, when it exists. */
function serviceAgent(input: TrackerHostInstallInput, ports: TrackerHostInstallPorts) {
	const path = agentPath(input, serviceLabel);
	const read = (key: string) => {
		const result = ports.run('/usr/bin/plutil', ['-extract', key, 'raw', '-o', '-', path]);
		return result.status === 0 ? result.stdout.replace(/\n$/, '') : undefined;
	};
	if (read('ProgramArguments.0') === undefined) return undefined;
	const logs = [read('StandardOutPath'), read('StandardErrorPath')];
	return { path, logs: [...new Set(logs.filter((log) => log !== undefined))] };
}
