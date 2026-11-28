// @harness-uid u_fyf7e7kyi5
import type { TrackerTmuxPane } from '../TrackerTmuxAdapter.types';

/** MB2's Aqua Tracker service starts this server for new native Claude runs. */
export const trackerClaudeAquaSocket = 'tracker-claude-aqua';

export function trackerTmuxSockets(node: string): string[] {
	return node === 'harbor-mbp-2' ? ['claude', trackerClaudeAquaSocket, 'default'] : ['default'];
}

const fields = [
	'session_name',
	'session_created',
	'pid',
	'pane_id',
	'pane_pid',
	'window_activity',
	'cursor_x',
	'cursor_y',
	'pane_in_mode',
	'pane_dead',
	'pane_input_off',
	'session_attached',
	'session_windows',
	'window_panes',
	'pane_current_command'
];
export const trackerPaneFormat = fields.map((field) => `#{${field}}`).join('|');
export { trackerWatchdogSessionName as trackerSessionName } from '../../../services/projects-sessions/WatchdogPaneService';

export function trackerTmuxPane(
	raw: string,
	scope: { socket: string; primarySocket: boolean; names: RegExp }
): TrackerTmuxPane | undefined {
	const [
		name,
		created,
		server,
		id,
		pid,
		activity,
		x,
		y,
		mode,
		dead,
		off,
		attached,
		windows,
		count,
		command,
		extra
	] = raw.split('|');
	if (
		!validTrackerTmuxName(scope.names, { name, id, command, extra }) ||
		![created, server, pid, activity, x, y, mode, dead, off, attached, windows, count].every(
			isTmuxNumber
		)
	)
		return undefined;
	const { socket, primarySocket } = scope;
	const live = dead === '0';
	const readable = live && mode === '0' && off === '0';
	const ready = readable && windows === '1' && count === '1';
	return {
		id,
		raw,
		socket,
		pane: {
			name,
			key: `${socket}:${server}:${created}:${pid}:${id}`,
			activity: Number(activity) * 1000,
			createdAt: Number(created) * 1000,
			x: Number(x),
			y: Number(y),
			live,
			readable,
			ready,
			attached: Number(attached) > 0,
			runnerSocket: primarySocket || socket === trackerClaudeAquaSocket,
			currentCommand: command,
			screen: null
		}
	};
}

function validTrackerTmuxName(
	names: RegExp,
	{ name, id, command, extra }: { name: string; id?: string; command?: string; extra?: string }
): boolean {
	return (
		extra === undefined &&
		names.test(name) &&
		/^%[0-9]+$/.test(id ?? '') &&
		/^[-a-zA-Z0-9._+]{1,80}$/.test(command ?? '')
	);
}

function isTmuxNumber(value: string | undefined): boolean {
	return /^[0-9]{1,13}$/.test(value ?? '');
}

export function matchesTrackerTmuxPane(
	observed: TrackerTmuxPane['pane'],
	expected: Pick<TrackerTmuxPane['pane'], 'key' | 'activity' | 'createdAt' | 'x' | 'y'>
): boolean {
	const { key, activity, createdAt, x, y } = expected;
	return (
		observed.key === key &&
		observed.activity === activity &&
		observed.createdAt === createdAt &&
		observed.x === x &&
		observed.y === y
	);
}

/** Keys for one pane: text and Enter, Enter alone, or text that a later Enter submits. */
export function trackerTmuxKeys(paneId: string, message?: string, enter = true): string {
	const keys = [];
	if (message !== undefined)
		keys.push(`send-keys -t ${paneId} -l '${message.replaceAll("'", "'\\''")}'`);
	if (enter) keys.push(`send-keys -t ${paneId} Enter`);
	return [...keys, 'display-message -p tracker-watchdog-sent'].join(' ; ');
}
