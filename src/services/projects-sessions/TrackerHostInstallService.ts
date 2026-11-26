// @harness-uid u_n2az4s5ol5
import type {
	TrackerHostInstallInput,
	TrackerHostInstallPorts,
	TrackerHostKind
} from './TrackerHostInstallService.types';
import { launchdTrackerHost } from './tracker-host-service-install/launchdTrackerHost';
import { shellTrackerHost } from './tracker-host-service-install/shellTrackerHost';
import { systemdTrackerHost } from './tracker-host-service-install/systemdTrackerHost';

const hosts = { systemd: systemdTrackerHost, shell: shellTrackerHost, launchd: launchdTrackerHost };

/** Puts one node under its host: systemd units, a shell-started supervisor, or a macOS health agent. */
export class TrackerHostInstallService {
	constructor(
		private readonly input: TrackerHostInstallInput,
		private readonly ports: TrackerHostInstallPorts
	) {}

	static detect(platform: string, ports: TrackerHostInstallPorts): TrackerHostKind {
		if (platform === 'darwin') return 'launchd';
		if (platform !== 'linux') throw new TypeError('Tracker supervision needs Linux or macOS');
		const user = ports.run('systemctl', ['--user', 'show-environment']);
		return user.status === 0 ? 'systemd' : 'shell';
	}

	/** What an install would write, without changing anything. */
	files(kind: TrackerHostKind) {
		return hosts[kind].files(this.input, this.ports);
	}

	install(kind: TrackerHostKind): string[] {
		return hosts[kind].install(this.input, this.ports);
	}

	uninstall(kind: TrackerHostKind): string[] {
		return hosts[kind].uninstall(this.input, this.ports);
	}
}
