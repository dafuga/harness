// @harness-uid u_trvsc33zhs
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import type { TrackerHostInstallInput } from '../TrackerHostInstallService.types';
import { trackerHealthTimes } from '../tracker-host-supervisor-service/trackerHealthTimes';
import { danielQuietHours } from '../tracker-notification-service/notificationRules';
import { requireHostCommand, writeHostFiles } from './hostFileWrites';
import { systemdWord } from './systemdWord';
import type { TrackerHost } from './trackerHost.types';

const service = 'harness-tracker.service';
const timer = 'harness-tracker-health.timer';
const names = [service, 'harness-tracker-health.service', timer];

export const systemdTrackerHost: TrackerHost = {
	files(input) {
		const directory = unitDirectory(input);
		return units(input).map((content, index) => ({
			path: join(directory, names[index]),
			content
		}));
	},
	install(input, ports) {
		writeHostFiles(this.files(input, ports));
		requireHostCommand(ports, 'systemctl', ['--user', 'daemon-reload']);
		requireHostCommand(ports, 'systemctl', ['--user', 'enable', service, timer]);
		requireHostCommand(ports, 'systemctl', ['--user', 'restart', service, timer]);
		return [
			`installed and started ${service} and ${timer}`,
			'Logs go to the journal, which rotates them: journalctl --user -u harness-tracker',
			'To start at boot without a login, run once: loginctl enable-linger'
		];
	},
	uninstall(input, ports) {
		ports.run('systemctl', ['--user', 'disable', '--now', service, timer]);
		for (const { path } of this.files(input, ports)) rmSync(path, { force: true });
		ports.run('systemctl', ['--user', 'daemon-reload']);
		return ['removed the Tracker systemd units; data and configuration are unchanged'];
	}
};

function unitDirectory({ home }: TrackerHostInstallInput): string {
	return join(home, '.config', 'systemd', 'user');
}

function units({ executable, config, role }: TrackerHostInstallInput): string[] {
	const command = (...words: string[]) => [executable, ...words].map(systemdWord).join(' ');
	const slots = trackerHealthTimes.map(
		(time) => `OnCalendar=*-*-* ${time}:00 ${danielQuietHours.tz}`
	);
	return [
		`[Unit]
Description=Harness Tracker service
After=network-online.target
StartLimitIntervalSec=0

[Service]
ExecStart=${command('tracker', 'serve', '--config', config, '--role', role)}
Restart=always
RestartSec=5

[Install]
WantedBy=default.target
`,
		`[Unit]
Description=Harness Tracker health check

[Service]
Type=oneshot
ExecStart=${command('tracker', 'health', '--alert', '--config', config)}
SuccessExitStatus=1
TimeoutStartSec=120
`,
		`[Unit]
Description=Harness Tracker health schedule

[Timer]
OnActiveSec=5min
${slots.join('\n')}
Persistent=true

[Install]
WantedBy=timers.target
`
	];
}
