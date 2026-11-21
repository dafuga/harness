// @harness-uid u_5lrhbf453w
import { WatchdogPaneService } from './WatchdogPaneService';
import {
	hasLiveSession,
	recoveryGrace,
	stoppedAliases
} from './watchdog-recovery-service/watchdogRecoverySessions';
import type {
	AnsweredItem,
	RecoveryDecision,
	RecoveryItem,
	RecoverySnapshot,
	ResumeDecision,
	ResumeSnapshot
} from './WatchdogRecoveryService.types';

const restartCooldown = 1_800_000;
function eligibleItem(item: RecoveryItem): boolean {
	return (
		!item.deleted &&
		item.status === 'in_progress' &&
		item.type === 'task' &&
		!item.every &&
		!item.nonWorkReason
	);
}

function recoveryOwner(input: RecoverySnapshot): string | null {
	const { target } = input.item;
	const owner = target && target !== 'auto' ? target : input.history.at(-1)?.node;
	return owner ? (input.hostAliases?.get(owner) ?? owner) : null;
}

function refusesLaunch(
	{ item, launcherEnabled, localHold, scheduledHold, repoExists }: RecoverySnapshot,
	queued: boolean
): string | null {
	if (item.needsDaniel && !item.resolved)
		return `waiting on Daniel${item.question ? `: ${item.question}` : ''}`;
	if (!launcherEnabled) return 'launcher disabled on this computer';
	if (localHold) return localHold;
	if (queued && scheduledHold) return scheduledHold;
	return repoExists ? null : 'working directory missing on this computer';
}

function recentItemActivity(input: RecoverySnapshot): number {
	return Math.max(input.item.statusAt ?? 0, input.history.at(-1)?.endedAt ?? 0);
}

function missingRunAction(input: RecoverySnapshot): Pick<RecoveryDecision, 'action' | 'reason'> {
	const queued = Boolean(input.item.autoToken && !input.tokenStarted);
	if (!queued && input.now - recentItemActivity(input) < recoveryGrace) return { action: 'grace' };
	const reason = refusesLaunch(input, queued);
	if (reason) return { action: 'refused', reason };
	if (queued) return { action: 'queued' };
	const recentRestart = input.now - (input.lastRestartAt ?? -Infinity) < restartCooldown;
	return { action: recentRestart ? 'cooldown' : 'relaunch' };
}

function clockMillis(clock?: string): number {
	return Number(/^(\d{15})-\d{6}-.+$/.exec(clock ?? '')?.[1] ?? 0);
}

function currentAnswer(item: AnsweredItem): string | null {
	if (!item.resolved || item.needsDaniel || item.deleted || !item.answeredAt) return null;
	const { answer, question } = item.clocks;
	return answer && answer > (question ?? '') ? answer : null;
}

function hasAnswer({ item, run }: ResumeSnapshot): boolean {
	const answer = currentAnswer(item);
	if (!answer) return false;
	const { status, blockedReason } = item.clocks;
	if (item.status === 'blocked') return Boolean(status && answer > status);
	if (item.status !== 'in_progress' || (item.blockedReason && answer <= (blockedReason ?? '')))
		return false;
	return Math.max(clockMillis(answer), clockMillis(status)) >= (run.endedAt ?? 0);
}

function eligibleRun({ item, run, localRuns, exitCode }: ResumeSnapshot): boolean {
	if (run.itemId !== item.id || !run.tmux || run.startedAt == null || exitCode !== null)
		return false;
	if (run.state === 'running') return item.status === 'blocked';
	if (run.state !== 'finished' || run.outcome !== 'blocked') return false;
	return !localRuns.some(
		(next) => next.itemId === item.id && next.id > run.id && next.startedAt != null
	);
}

function outsideOwner(input: RecoverySnapshot, computer: string | null): RecoveryDecision | null {
	if (!input.targeted) return null;
	const entry = { id: input.item.id, computer };
	if (computer !== input.host) return { ...entry, action: computer ? 'other_host' : 'unassigned' };
	return { ...entry, action: 'opted_out', reason: 'automatic launch opted out' };
}

export class WatchdogRecoveryService {
	private readonly panes = new WatchdogPaneService();

	/** Plans only when the current pane inventory is available. */
	plan(input: RecoverySnapshot): RecoveryDecision | null {
		const { item, panes, host } = input;
		if (!panes || !eligibleItem(item)) return null;
		const computer = recoveryOwner(input);
		const entry = { id: item.id, computer };
		if (computer !== host || (item.scheduleOff && !item.autoToken))
			return outsideOwner(input, computer);
		const stopped = stoppedAliases(input, panes);
		if (hasLiveSession(input, panes, stopped)) return { ...entry, action: 'live' };
		const decision = missingRunAction(input);
		if (decision.action === 'grace' || !stopped.length) return { ...entry, ...decision };
		return { ...entry, ...decision, stoppedPanes: stopped };
	}

	/** A valid answer resumes the same run. A caller reopens the item before updating the run. */
	resume(input: ResumeSnapshot): ResumeDecision | null {
		const { item, run, panes } = input;
		if (
			!eligibleRun(input) ||
			!hasAnswer(input) ||
			!panes?.some((pane) => this.panes.matchesRun(pane, run))
		)
			return null;
		return {
			runId: run.id,
			reopenItem: item.status === 'blocked',
			resumedAt: Math.max(input.now, (run.resumedAt ?? 0) + 1)
		};
	}
}
