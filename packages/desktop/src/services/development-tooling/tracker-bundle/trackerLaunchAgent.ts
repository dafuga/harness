// @harness-uid u_tb3pw6ksvh
import { copyFile, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { trackerLabel } from './trackerBundleLayout';
import type { TrackerBundleHost } from './TrackerBundleService.types';
import { TrackerBundleError } from './TrackerBundleError';
import type { NewAgent } from './trackerLaunchAgent.types';

const plutil = '/usr/bin/plutil';
const launchctl = '/bin/launchctl';

/** The service's command line, or null when the agent file is missing or unreadable. */
export async function readAgentProgram(
	agent: string,
	host: TrackerBundleHost
): Promise<string[] | null> {
	const result = await host.run(plutil, ['-extract', 'ProgramArguments', 'json', '-o', '-', agent]);
	if (result.status !== 0) return null;
	const parsed: unknown = JSON.parse(result.stdout);
	return Array.isArray(parsed) && parsed.every((part) => typeof part === 'string') ? parsed : null;
}

/** True only for the `tracker serve` command line this bundle is allowed to repoint. */
export function isTrackerServe(program: string[] | null): program is string[] {
	return program !== null && program[1] === 'tracker' && program[2] === 'serve';
}

/** Repoints only the executable. The config path, role, environment and logs stay as they are. */
export async function setAgentExecutable(
	agent: string,
	executable: string,
	host: TrackerBundleHost
): Promise<void> {
	const staged = `${agent}.${process.pid}.tmp`;
	await copyFile(agent, staged);
	// `plutil -replace` on an array index inserts, so remove the old executable first.
	const removed = await host.run(plutil, ['-remove', 'ProgramArguments.0', staged]);
	const inserted = await host.run(plutil, [
		'-insert',
		'ProgramArguments.0',
		'-string',
		executable,
		staged
	]);
	if (removed.status !== 0 || inserted.status !== 0)
		throw new TrackerBundleError('The LaunchAgent could not be updated.');
	await rename(staged, agent);
}

/** The role in the Tracker configuration, which the service must keep. */
export async function configuredRole(config: string): Promise<'hub' | 'spoke' | null> {
	try {
		const role: unknown = JSON.parse(await readFile(config, 'utf8')).role;
		return role === 'hub' || role === 'spoke' ? role : null;
	} catch {
		return null;
	}
}

/** First install on a Mac that already has a Tracker configuration. */
export async function createAgent(input: NewAgent, host: TrackerBundleHost): Promise<void> {
	const text = (value: string) => `<string>${escapeXml(value)}</string>`;
	const path = [join(input.home, '.local/bin'), '/opt/homebrew/bin', '/usr/bin', '/bin'].join(':');
	const program = [input.executable, 'tracker', 'serve', '--config', input.config];
	const body = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>EnvironmentVariables</key>
	<dict>
		<key>HARNESS_TRACKER_CONFIG</key>
		${text(input.config)}
		<key>PATH</key>
		${text(path)}
	</dict>
	<key>KeepAlive</key>
	<true/>
	<key>Label</key>
	${text(trackerLabel)}
	<key>ProgramArguments</key>
	<array>
		${[...program, '--role', input.role].map(text).join('\n\t\t')}
	</array>
	<key>RunAtLoad</key>
	<true/>
	<key>StandardErrorPath</key>
	${text(join(input.logs, 'tracker.stderr.log'))}
	<key>StandardOutPath</key>
	${text(join(input.logs, 'tracker.stdout.log'))}
	<key>ThrottleInterval</key>
	<integer>10</integer>
	<key>WorkingDirectory</key>
	${text(input.home)}
</dict>
</plist>
`;
	await mkdir(dirname(input.agent), { recursive: true });
	await mkdir(input.logs, { recursive: true, mode: 0o700 });
	const staged = `${input.agent}.${process.pid}.tmp`;
	await writeFile(staged, body, { mode: 0o600 });
	if ((await host.run(plutil, ['-lint', staged])).status !== 0)
		throw new TrackerBundleError('The generated LaunchAgent is not a valid property list.');
	await rename(staged, input.agent);
}

function escapeXml(value: string): string {
	return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

export async function agentLoaded(host: TrackerBundleHost): Promise<boolean> {
	return (await host.run(launchctl, ['print', `gui/${host.uid}/${trackerLabel}`])).status === 0;
}

/** An absent label has exit status 113. Other lookup failures cannot confirm a stop. */
async function printAgent(host: TrackerBundleHost, target: string): Promise<string | null> {
	const { status, stdout } = await host.run(launchctl, ['print', target]);
	if (status === 113) return null;
	if (status !== 0)
		throw new TrackerBundleError(
			`Cannot confirm Tracker stopped (launchctl print exit ${status}).`
		);
	return stdout;
}

async function waitForBootout(
	host: TrackerBundleHost,
	target: string,
	stopping: Set<number>
): Promise<void> {
	const job = await printAgent(host, target);
	if (job !== null) {
		// Only the job's own top-level pid field, never a nested job or environment entry.
		const match = /^\tpid = ([1-9]\d*)$/m.exec(job);
		if (match) stopping.add(Number(match[1]));
		await host.run(launchctl, ['bootout', target]);
	} else if (stopping.size === 0) return;
	const interval = 250;
	const timeout = 60_000;
	for (let elapsed = 0; elapsed <= timeout; elapsed += interval) {
		if (
			(await printAgent(host, target)) === null &&
			![...stopping].some((id) => host.isProcessRunning(id))
		) {
			stopping.clear();
			return;
		}
		if (elapsed < timeout) await host.sleep(interval);
	}
	throw new TrackerBundleError('Tracker did not stop within 60 seconds.');
}

/** Waits for removal before loading the changed plist. Zero attempts requests unload only. */
export async function reloadAgent(
	agent: string,
	host: TrackerBundleHost,
	attempts = 5,
	stopping: Set<number> = new Set<number>()
): Promise<void> {
	const domain = `gui/${host.uid}`;
	await waitForBootout(host, `${domain}/${trackerLabel}`, stopping);
	for (let attempt = 1; attempt <= attempts; attempt++) {
		const { status } = await host.run(launchctl, ['bootstrap', domain, agent]);
		if (status === 0) return;
		if (attempt === attempts)
			throw new TrackerBundleError(`launchctl bootstrap failed for Tracker (exit ${status}).`);
		await host.sleep(1000);
	}
}
