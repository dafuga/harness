// @harness-uid u_f5lwwptgm5
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { runTrackerHostCommand } from '../tracker-host-process-adapter/trackerHostCommand';
import type { ClaudeStartupFailure } from '../../../services/projects-sessions/tracker-native-runtime-service/trackerHostLaunch.types';
import { claudeTrustDialog, confirmOwnedWorktreeTrust } from './trackerClaudeTrust';
import type { TrackerClaudeStartupProbe } from './trackerClaudeStartupPhase.types';
import type { TrackerManagedReceipt } from './trackerManagedHostLauncher.types';

const startupMilliseconds = 120_000;
const signedOutScreen = /^[ \t│]*Not logged in(?: - run security unlock-keychain)?[ \t│]*$/im;

/** `undefined` keeps waiting for the composer. */
export async function managedClaudeStartupPhase(
	probe: TrackerClaudeStartupProbe,
	receipt: TrackerManagedReceipt,
	signal: AbortSignal
): Promise<'ready' | ClaudeStartupFailure | undefined> {
	if (!probe.live) return 'claude-not-ready';
	const expired = Date.now() - receipt.issuedAt >= startupMilliseconds;
	const screen = await claudePaneScreen(probe, receipt.tmux, signal);
	const result = screen === undefined ? undefined : claudeScreenPhase(screen);
	if (result === 'claude-trust') {
		if (existsSync(join(probe.directory, 'trust-confirmed'))) return expired ? result : undefined;
		const pane = { ...probe, name: receipt.tmux, token: receipt.token };
		const sent = !expired && (await confirmOwnedWorktreeTrust(pane, screen!, signal));
		return sent ? undefined : result;
	}
	return result ?? (expired ? 'claude-not-ready' : undefined);
}

async function claudePaneScreen(
	{ tmux, socket }: TrackerClaudeStartupProbe,
	name: string,
	signal: AbortSignal
) {
	const { code, stdout } = await runTrackerHostCommand(
		tmux,
		['-L', socket, 'capture-pane', '-p', '-t', `=${name}:`],
		signal
	);
	return code === 0 ? stdout : undefined;
}

function claudeScreenPhase(screen: string): 'ready' | ClaudeStartupFailure | undefined {
	if (signedOutScreen.test(screen) || /^\s*Select login method:/m.test(screen))
		return 'claude-sign-in';
	if (/^─{8}.*\n❯(?:[ \u00A0].*)?\n─{8}.*\n\s*(?:[⏵⏸]+\s|\? for shortcuts\b)/mu.test(screen))
		return 'ready';
	if (/^\s*Choose the text style that looks best with your terminal/m.test(screen))
		return 'claude-onboarding';
	return claudeTrustDialog(screen) ? 'claude-trust' : undefined;
}
