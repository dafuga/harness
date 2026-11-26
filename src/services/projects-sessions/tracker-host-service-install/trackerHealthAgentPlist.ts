// @harness-uid u_jmqi2j4hlv
import type { TrackerHostInstallInput } from '../TrackerHostInstallService.types';
import { trackerHealthTimes } from '../tracker-host-supervisor-service/trackerHealthTimes';

/** Follow the service agent's executable, which each release repoints. */
const followService =
	'agent=$1; shift; exec "$(/usr/bin/plutil -extract ProgramArguments.0 raw -o - "$agent")" "$@"';

export function trackerHealthAgentPlist(
	label: string,
	input: TrackerHostInstallInput,
	service?: { path: string; logs: string[] }
): string {
	const { executable, config } = input;
	const check = ['tracker', 'health', '--alert', '--config', config];
	const rotate = (service?.logs ?? []).flatMap((log) => ['--log', log]);
	const program = service
		? ['/bin/sh', '-c', followService, 'tracker-health', service.path, ...check, ...rotate]
		: [executable, ...check];
	const slots = trackerHealthTimes.map((time) => {
		const [hour, minute] = time.split(':').map(Number);
		return `<dict><key>Hour</key><integer>${hour}</integer><key>Minute</key><integer>${minute}</integer></dict>`;
	});
	const output = service?.logs.at(-1);
	return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>Label</key>
	${text(label)}
	<key>ProgramArguments</key>
	<array>
		${program.map(text).join('\n\t\t')}
	</array>
	<key>StartCalendarInterval</key>
	<array>
		${slots.join('\n\t\t')}
	</array>${output ? `\n\t<key>StandardOutPath</key>\n\t${text(output)}\n\t<key>StandardErrorPath</key>\n\t${text(output)}` : ''}
</dict>
</plist>
`;
}

function text(value: string): string {
	const escaped = value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
	return `<string>${escaped}</string>`;
}
