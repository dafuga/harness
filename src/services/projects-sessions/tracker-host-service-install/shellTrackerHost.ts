// @harness-uid u_kxk4sjwjzc
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { TrackerHostInstallInput } from '../TrackerHostInstallService.types';
import type { TrackerHost } from './trackerHost.types';
import { stopTrackerSupervisor } from './stopTrackerSupervisor';

const begin = '# >>> harness tracker supervise >>>';
const end = '# <<< harness tracker supervise <<<';

/** For containers without systemd: every new shell makes sure one supervisor is running. */
export const shellTrackerHost: TrackerHost = {
	files(input) {
		const path = join(input.home, '.bashrc');
		const kept = withoutBlock(readExisting(path));
		const line = supervise(input).map(shellWord).join(' ');
		const block = `${begin}\n(nohup ${line} >/dev/null 2>&1 &)\n${end}\n`;
		const gap = kept && !kept.endsWith('\n') ? '\n' : '';
		return [{ path, content: kept + gap + block }];
	},
	install(input, ports) {
		for (const { path, content } of this.files(input, ports)) writeFileSync(path, content);
		ports.start(supervise(input));
		return [
			'started the Tracker supervisor and added its start line to ~/.bashrc',
			`It restarts the service, rotates ${input.database}.log and checks health every 4 hours.`,
			'After a container restart it starts with the first new shell.'
		];
	},
	uninstall(input) {
		const path = join(input.home, '.bashrc');
		const existing = readExisting(path);
		if (existing.includes(begin)) writeFileSync(path, withoutBlock(existing));
		const stopped = stopTrackerSupervisor(input.database);
		return [
			'removed the ~/.bashrc start line; data and configuration are unchanged',
			stopped ? 'stopped the running supervisor' : 'no supervisor was running'
		];
	}
};

function supervise({ executable, config, role }: TrackerHostInstallInput): string[] {
	return [executable, 'tracker', 'supervise', '--config', config, '--role', role];
}

function readExisting(path: string): string {
	try {
		return readFileSync(path, 'utf8');
	} catch (error) {
		if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return '';
		throw error;
	}
}

function withoutBlock(text: string): string {
	const start = text.indexOf(begin);
	const finish = text.indexOf(end, start);
	if (start < 0 || finish < 0) return text;
	return text.slice(0, start) + text.slice(finish + end.length).replace(/^\n/, '');
}

function shellWord(word: string): string {
	return `'${word.replaceAll("'", "'\\''")}'`;
}
