// @harness-uid u_oexlu2ge7b
import { readFileSync } from 'node:fs';
import { dirname, isAbsolute, join } from 'node:path';
import { missingTmuxSession } from '../../../adapters/projects-sessions/tracker-tmux-adapter/trackerTmuxClose';
import { runTrackerHostCommand } from '../../../adapters/projects-sessions/tracker-host-process-adapter/trackerHostCommand';

export function hygienePane(directory: string) {
	const {
		HARNESS_TRACKER_TMUX: tmux,
		HARNESS_TRACKER_SOCKET: socket,
		HARNESS_TRACKER_PANE: pane
	} = process.env;
	if (
		!tmux ||
		!isAbsolute(tmux) ||
		!socket ||
		!pane ||
		!/^auto-[a-z0-9]{6}-r[1-9][0-9]*$/.test(pane)
	)
		return undefined;
	const attempt = readFileSync(join(dirname(directory), 'started'), 'utf8').trim();
	if (!/^[a-f0-9]{64}$/.test(attempt)) return undefined;
	const owner = 'HARNESS_TRACKER_ATTEMPT=' + attempt;
	const command = (args: string[]) =>
		runTrackerHostCommand(tmux, ['-L', socket, ...args], AbortSignal.timeout(5000));
	return {
		presence: () => findPane(command, pane, owner),
		timeout: () => stopPane(command, pane, attempt)
	};
}

async function findPane(
	command: (args: string[]) => ReturnType<typeof runTrackerHostCommand>,
	pane: string,
	owner: string
) {
	const result = await command([
		'show-environment',
		'-t',
		'=' + pane,
		'HARNESS_TRACKER_ATTEMPT'
	]).catch(() => undefined);
	if (result?.code === 0) return result.stdout.trim() === owner ? 'owned' : 'gone';
	if (result?.code === 1 && missingTmuxSession(result.stderr, pane)) return 'gone';
	return 'unknown';
}

async function stopPane(
	command: (args: string[]) => ReturnType<typeof runTrackerHostCommand>,
	pane: string,
	attempt: string
) {
	const result = await command([
		'if-shell',
		'-F',
		'-t',
		'=' + pane + ':',
		'#{==:#{HARNESS_TRACKER_ATTEMPT},' + attempt + '}',
		'display-message -p tracker-hygiene-timed-out ; kill-session -t =' + pane
	]).catch(() => undefined);
	if (result?.stdout.trim() !== 'tracker-hygiene-timed-out') return false;
	return (await findPane(command, pane, 'HARNESS_TRACKER_ATTEMPT=' + attempt)) === 'gone';
}
