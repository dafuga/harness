import { realpathSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { runTrackerHostCommand } from '../tracker-host-process-adapter/trackerHostCommand';
import type { TrackerClaudeTrustPane } from './trackerClaudeTrust.types';

const dialog =
	/^\s*Accessing workspace:\s*$[\s\S]*^\s*Quick safety check: Is this a project you created or one you trust\?[\s\S]*Enter to confirm\s*·\s*Esc to cancel\s*$/m;
const noSelected = /^\s*❯\s+No, exit\s*\n\s*Yes, I trust this folder\s*$/m;
const ownedOrigin =
	/^(?:(?:https:\/\/|ssh:\/\/git@)github\.com\/|git@github\.com:)dafuga\/[a-z0-9_.-]+$/i;

export function claudeTrustDialog(screen: string): boolean {
	return dialog.test(screen.trimEnd());
}

/**
 * Answer the folder-trust dialog once, only in an unattended pane sitting in the attempt's own
 * checkout of one of Daniel's repositories. Returns false when the dialog must stay for a person.
 */
export async function confirmOwnedWorktreeTrust(
	pane: TrackerClaudeTrustPane,
	screen: string,
	signal: AbortSignal
): Promise<boolean> {
	if (!noSelected.test(screen) || !(await ownedWorktree(pane, signal))) return false;
	// Claim before sending keys so one launch is never approved twice.
	writeFileSync(join(pane.directory, 'trust-confirmed'), '', { mode: 0o600, flag: 'wx' });
	const { tmux, socket, name, token } = pane;
	const guard = `#{&&:#{==:#{HARNESS_TRACKER_ATTEMPT},${token}},#{==:#{session_attached},0}}`;
	const sent = await runTrackerHostCommand(
		tmux,
		['-L', socket, 'if-shell', '-F', '-t', `=${name}:`, guard, `send-keys -t =${name}: Down Enter`],
		signal
	);
	return sent.code === 0;
}

async function ownedWorktree(
	{ tmux, socket, name, directory }: TrackerClaudeTrustPane,
	signal: AbortSignal
): Promise<boolean> {
	try {
		const worktree = realpathSync(join(directory, 'worktree'));
		const cwd = await runTrackerHostCommand(
			tmux,
			['-L', socket, 'display-message', '-p', '-t', `=${name}:`, '#{pane_current_path}'],
			signal
		);
		if (cwd.code !== 0 || realpathSync(cwd.stdout.trimEnd()) !== worktree) return false;
		const git = (...args: string[]) =>
			runTrackerHostCommand('/usr/bin/git', ['-C', worktree, ...args], signal);
		const [configured, effective] = await Promise.all([
			git('config', '--get-all', 'remote.origin.url'),
			git('remote', 'get-url', '--all', 'origin')
		]);
		const origin = configured.stdout.trim();
		return configured.code === 0 && effective.stdout.trim() === origin && ownedOrigin.test(origin);
	} catch {
		signal.throwIfAborted();
		return false;
	}
}
