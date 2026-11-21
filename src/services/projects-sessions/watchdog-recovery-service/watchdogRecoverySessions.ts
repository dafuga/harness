// @harness-uid u_uydo5fzp4r
import { createHash } from 'node:crypto';
import { WatchdogPaneService } from '../WatchdogPaneService';
import type { RecoverySnapshot } from '../WatchdogRecoveryService.types';
import type { WatchdogPane } from '../WatchdogPaneService.types';

export const recoveryGrace = 600_000;
const paneService = new WatchdogPaneService();

function sessionKey(name: string): string {
	return createHash('sha256').update(name.trim().toLowerCase().replace(/\s+/g, ' ')).digest('hex');
}

export function stoppedAliases(input: RecoverySnapshot, panes: readonly WatchdogPane[]): string[] {
	const matching = panes.filter(
		(pane) => paneService.manualItem(pane, input.items)?.id === input.item.id
	);
	const live = new Set(
		matching
			.filter(
				(pane) =>
					pane.live &&
					!paneService.isStopped(
						pane,
						input.item.notes ?? [],
						input.host,
						paneService.idlePrompt(pane)
					)
			)
			.map((pane) => pane.name)
	);
	return [...new Set(matching.map((pane) => pane.name))].filter((name) => !live.has(name));
}

export function hasLiveSession(
	input: RecoverySnapshot,
	panes: readonly WatchdogPane[],
	stopped: readonly string[]
): boolean {
	const { item, localRuns, now } = input;
	const runs = localRuns.filter((run) => run.itemId === item.id);
	const since = now - recoveryGrace;
	const managedPane = panes.some(
		(pane) =>
			pane.activity >= since &&
			runs.some((run) => run.state === 'finished' && paneService.matchesRun(pane, run))
	);
	const manualPane = panes.some(
		(pane) =>
			pane.live &&
			!stopped.includes(pane.name) &&
			paneService.manualItem(pane, input.items)?.id === item.id
	);
	return (
		runs.some((run) => run.state === 'running' || run.state === 'verifying') ||
		managedPane ||
		manualPane ||
		Boolean(input.activeRemoteRun) ||
		hasRecentPeerPane(input, since) ||
		hasSessionAlias(input, stopped)
	);
}

function hasRecentPeerPane(input: RecoverySnapshot, since: number): boolean {
	const peers = new Map(
		input.peers
			?.filter(
				(peer) =>
					peer.node !== (input.node ?? input.host) &&
					peer.sampledAt >= since &&
					peer.managedPaneActivity
			)
			.map((peer) => [peer.node, peer.managedPaneActivity])
	);
	return input.history.some((run) => {
		if (run.itemId !== input.item.id || !run.tmux) return false;
		const key = sessionKey(run.tmux);
		return peers
			.get(run.node)
			?.some(([name, active]) => name === key && Number.isFinite(active) && active >= since);
	});
}

function hasSessionAlias(input: RecoverySnapshot, stopped: readonly string[]): boolean {
	const { item } = input;
	const short = item.id.slice(0, 6);
	const aliases = [
		item.id,
		short,
		`auto-${short}`,
		`auto-${item.id}`,
		...(item.sessionAliases ?? [])
	];
	const local = new Set(input.localSessionNames?.map(sessionKey));
	const peers = new Set(
		input.peers?.flatMap((peer) =>
			peer.node !== input.host && !peer.offline ? (peer.sessionKeys ?? []) : []
		)
	);
	return aliases.some(
		(name) =>
			name &&
			(peers.has(sessionKey(name)) || (!stopped.includes(name) && local.has(sessionKey(name))))
	);
}
