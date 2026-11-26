import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, vi } from 'vitest';
import { TrackerHostInstallService } from '../../../src/services/projects-sessions/TrackerHostInstallService';
import { TrackerHostSupervisorService } from '../../../src/services/projects-sessions/TrackerHostSupervisorService';
import { nextTrackerHealthAt } from '../../../src/services/projects-sessions/tracker-host-supervisor-service/nextTrackerHealthAt';
import { trackerSupervisorFiles } from '../../../src/services/projects-sessions/tracker-host-supervisor-service/trackerSupervisorFiles';
import { trackerProcessRows } from '../../../src/services/projects-sessions/tracker-health-service/trackerProcessRows';
import { harnessSelfCommand } from '../../../src/commands/projects-sessions/tracker-command/harnessSelfCommand';
import { withTempDir } from '../../support/temporary';

const node = (script: string) => [process.execPath, '-e', script];

test(
	'the supervisor restarts a crashing service, runs health, rotates, stays single and stops',
	() =>
		withTempDir('hts-', async (root) => {
			const files = trackerSupervisorFiles(join(root, 'tracker.sqlite'));
			writeFileSync(files.log, 'x'.repeat(4096));
			let healthRuns = 0;
			const options = {
				...files,
				serve: node('console.log("served"); process.exit(3)'),
				health: node('console.log("checked")'),
				backoff: { initialMs: 5, maxMs: 20, stableMs: 60_000 },
				maintenanceMs: 5,
				logLimit: 2048,
				nextHealthAt: (now: number) => now + (healthRuns++ ? 60_000 : 10)
			};
			const stop = new AbortController();
			const running = new TrackerHostSupervisorService(options).run(stop.signal);
			try {
				await vi.waitFor(
					() => {
						const log = readFileSync(files.log, 'utf8');
						expect(log.match(/^served$/gm)?.length).toBeGreaterThan(2);
						expect(log).toContain('checked');
						expect(log).toContain('exited (code 3)');
					},
					{ timeout: 10_000 }
				);
				expect(readFileSync(files.log + '.1', 'utf8')).toContain('x'.repeat(4096));
				expect(readFileSync(files.pidFile, 'utf8')).toBe(`${process.pid}\n`);
				await expect(new TrackerHostSupervisorService(options).run(stop.signal)).resolves.toBe(
					'already-running'
				);
			} finally {
				stop.abort();
			}
			await expect(running).resolves.toBe('stopped');
		}),
	20_000
);

test(
	'stopping the supervisor drains the running service',
	() =>
		withTempDir('hts-', async (root) => {
			const files = trackerSupervisorFiles(join(root, 'tracker.sqlite'));
			const serve = node(
				'process.on("SIGTERM",()=>{console.log("drained");process.exit(0)});console.log("up");setInterval(()=>{},1000)'
			);
			const stop = new AbortController();
			const running = new TrackerHostSupervisorService({ ...files, serve, health: node('') }).run(
				stop.signal
			);
			await vi.waitFor(() => expect(readFileSync(files.log, 'utf8')).toContain('up'), {
				timeout: 10_000
			});
			stop.abort();
			await running;
			expect(readFileSync(files.log, 'utf8')).toContain('drained');
		}),
	20_000
);

test('health runs 5 minutes after start, then at the next 4-hour Lisbon slot', () => {
	const now = Date.parse('2026-07-15T09:10:00Z');
	expect(nextTrackerHealthAt(now, true)).toBe(now + 300_000);
	expect(new Date(nextTrackerHealthAt(now, false)).toISOString()).toBe('2026-07-15T11:00:00.000Z');
});

function hostFixture(
	root: string,
	run = (_command: string, _args: string[]) => ({ status: 0, stdout: '' })
) {
	const calls: string[] = [];
	const started: string[][] = [];
	const ports = {
		run: (command: string, args: string[]) => {
			calls.push([command, ...args].join(' '));
			return run(command, args);
		},
		start: (command: string[]) => void started.push(command)
	};
	const input = {
		executable: '/opt/harness bin/harness',
		config: join(root, 'tracker.json'),
		role: 'hub' as const,
		database: join(root, 'tracker.sqlite'),
		home: root,
		uid: 501
	};
	return { service: new TrackerHostInstallService(input, ports), calls, started, ports, input };
}

test('systemd gets a restarting service and a persistent 4-hourly health timer', () =>
	withTempDir('hti-', (root) => {
		const { service, calls } = hostFixture(root);
		service.install('systemd');
		const units = join(root, '.config/systemd/user');
		const unit = readFileSync(join(units, 'harness-tracker.service'), 'utf8');
		expect(unit).toContain('ExecStart="/opt/harness bin/harness" "tracker" "serve"');
		expect(unit).toContain('Restart=always');
		const timer = readFileSync(join(units, 'harness-tracker-health.timer'), 'utf8');
		expect(timer).toContain('OnCalendar=*-*-* 04:00:00 Europe/Lisbon');
		expect(timer).toContain('OnActiveSec=5min');
		expect(readFileSync(join(units, 'harness-tracker-health.service'), 'utf8')).toContain(
			'"health" "--alert"'
		);
		expect(calls).toContain(
			'systemctl --user enable harness-tracker.service harness-tracker-health.timer'
		);
		service.uninstall('systemd');
		expect(() => readFileSync(join(units, 'harness-tracker.service'))).toThrow();
	}));

test('a host without systemd gets one reversible shell hook and a started supervisor', () =>
	withTempDir('hti-', (root) => {
		const { service, started, ports } = hostFixture(root, () => ({ status: 1, stdout: '' }));
		expect(TrackerHostInstallService.detect('linux', ports)).toBe('shell');
		writeFileSync(join(root, '.bashrc'), 'export KEEP=1\n');
		service.install('shell');
		service.install('shell');
		const bashrc = readFileSync(join(root, '.bashrc'), 'utf8');
		expect(bashrc.match(/tracker' 'supervise'/g)).toHaveLength(1);
		execFileSync('bash', ['-n', join(root, '.bashrc')]);
		expect(started[0].slice(1, 3)).toEqual(['tracker', 'supervise']);
		expect(service.uninstall('shell')).toContain('no supervisor was running');
		expect(readFileSync(join(root, '.bashrc'), 'utf8')).toBe('export KEEP=1\n');
	}));

test('macOS health agent follows the service executable and rotates its logs', () =>
	withTempDir('hti-', (dir) => {
		const root = realpathSync(dir);
		mkdirSync(join(root, 'Library/LaunchAgents'), { recursive: true });
		const agentValues: Record<string, string> = {
			'ProgramArguments.0': '/releases/new/harness\n',
			StandardOutPath: '/logs/out.log\n',
			StandardErrorPath: '/logs/err.log\n'
		};
		const { service, calls } = hostFixture(root, (_command, args) => ({
			status: 0,
			stdout: agentValues[args[1]] ?? ''
		}));
		service.install('launchd');
		const plist = readFileSync(
			join(root, 'Library/LaunchAgents/local.harness.tracker-health.plist'),
			'utf8'
		);
		expect(plist).toContain('local.harness.tracker.plist</string>');
		expect(plist).toContain('<string>--log</string>\n\t\t<string>/logs/out.log</string>');
		expect(plist).toContain('<string>/logs/err.log</string>');
		expect(plist.match(/<key>Hour<\/key>/g)).toHaveLength(6);
		expect(calls.some((call) => call.startsWith('/bin/launchctl bootstrap gui/501 '))).toBe(true);
		expect(calls.some((call) => /bootout gui\/501\/local\.harness\.tracker$/.test(call))).toBe(
			false
		);
		if (process.platform === 'darwin')
			execFileSync('/usr/bin/plutil', [
				'-lint',
				join(root, 'Library/LaunchAgents/local.harness.tracker-health.plist')
			]);
	}));

test('process rows and self invocation parse both launcher shapes', () => {
	expect(
		trackerProcessRows('  12 2-03:04:05 harness tracker serve\n  13    07:30 bun x\n')
	).toEqual([
		{ pid: 12, ageMinutes: 3064, command: 'harness tracker serve ' },
		{ pid: 13, ageMinutes: 7, command: 'bun x ' }
	]);
	expect(harnessSelfCommand(['bun', '/$bunfs/root/harness'], '/bin/harness')).toEqual([
		'/bin/harness'
	]);
	expect(harnessSelfCommand(['bun', '/src/cli/index.ts'], '/bin/bun')).toEqual([
		'/bin/bun',
		'/src/cli/index.ts'
	]);
});
