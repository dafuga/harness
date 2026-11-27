// @harness-uid u_bl6xl2h4a3
import { createHash } from 'node:crypto';
import type { TrackerTmuxAdapter } from '../../../adapters/projects-sessions/TrackerTmuxAdapter';
import type { TrackerRunReceipt } from '../../agents-providers/TrackerDispatcherService.types';
import type { TrackerPersistenceService } from '../TrackerPersistenceService';
import { trackerWatchdogSessionName } from '../WatchdogPaneService';
import type { WatchdogCli, WatchdogPane } from '../WatchdogPaneService.types';
import { recordWatchdogAlert } from './trackerHostWatchdogAlerts';

export const trackerProviders = ['codex', 'claude'] as const;

// A notice counts only behind the CLI's own glyph, so quoted text in a transcript is ignored.
const notices: Record<WatchdogCli, RegExp> = {
	codex:
		/^\s*■\s+(?:you['’]ve hit your usage limit|workspace (?:owner|member) credits (?:are )?depleted|(?:you['’]re )?out of credits|spend limit (?:was )?reached)/i,
	claude:
		/^\s*⎿\s+(?:you['’]ve (?:hit|reached) your (?:(?:session|5-hour|weekly|usage) )?limit|you['’]ve reached your usage limit|you['’]re out of (?:extra )?usage|credit balance is too low)/i
};
const creditWarning =
	/using (?:available )?credits|continu(?:e|ing) (?:with|on) credits automatically/i;
const escape = '\u001b';
const styles = new RegExp(escape + '\\[[0-9;:]*m', 'g');

const holdKey = (cli: string) => `autolaunch_quota_${cli}`;

export function trackerQuotaHold(store: TrackerPersistenceService, cli: string): string | null {
	const held = store.getMeta(holdKey(cli));
	return held === '' ? null : held;
}

export function heldTrackerProviders(store: TrackerPersistenceService): WatchdogCli[] {
	return trackerProviders.filter((cli) => trackerQuotaHold(store, cli));
}

export function clearTrackerQuotaHold(store: TrackerPersistenceService, cli: string): void {
	store.writeMeta({ [holdKey(cli)]: '' });
}

const codexPauseKey = 'tracker_codex_paused_until';

/** The launcher records its configured pause so every reader on this computer agrees. */
export function configuredTrackerProviderHold(
	store: TrackerPersistenceService,
	codexPausedUntil = '',
	now: () => number = Date.now
) {
	if ((store.getMeta(codexPauseKey) ?? '') !== codexPausedUntil)
		store.writeMeta({ [codexPauseKey]: codexPausedUntil });
	return (cli: string) => trackerProviderHold(store, cli, now());
}

export function trackerCodexPause(store: TrackerPersistenceService, now: number) {
	const stored = store.getMeta(codexPauseKey);
	const until = stored === '' ? null : stored;
	return { codex_paused: now < Date.parse(until ?? ''), codex_paused_until: until };
}

/** Why this computer may not start `cli` now. */
export function trackerProviderHold(
	store: TrackerPersistenceService,
	cli: string,
	now: number
): string | null {
	if (trackerQuotaHold(store, cli)) return `${cli} quota exhausted on ${store.node}`;
	const pause = trackerCodexPause(store, now);
	return cli === 'codex' && pause.codex_paused
		? `Codex paused until ${pause.codex_paused_until}`
		: null;
}

/** The exhaustion notice on a screen. Warnings that say work continues on credits do not count. */
export function trackerQuotaNotice(screen: string, cli: WatchdogCli): string | null {
	const lines = screen.replace(styles, '').split('\n');
	const found = lines.find(
		(line, index) =>
			notices[cli].test(line) && !creditWarning.test(`${line} ${lines[index + 1]?.trim() ?? ''}`)
	);
	return found?.trim() ?? null;
}

/** Capture only the panes of this computer's own runs. */
export async function watchTrackerQuota(
	store: TrackerPersistenceService,
	{
		tmux,
		runs,
		now
	}: { tmux?: TrackerTmuxAdapter; runs: readonly TrackerRunReceipt[]; now: number },
	signal: AbortSignal
): Promise<void> {
	const names = runs.flatMap(({ tmux: name }) =>
		name && trackerWatchdogSessionName.test(name) ? [name] : []
	);
	if (!tmux || !names.length) return;
	const panes = await tmux.scan(signal, new RegExp(`^(?:${names.join('|')})$`));
	signal.throwIfAborted();
	observeTrackerQuota(store, { runs, panes, now });
}

/** Hold a provider the first time one of its runs shows a notice. */
export function observeTrackerQuota(
	store: TrackerPersistenceService,
	{
		runs,
		panes,
		now
	}: { runs: readonly TrackerRunReceipt[]; panes: readonly WatchdogPane[]; now: number }
): void {
	for (const run of runs) {
		if (run.cli !== 'codex' && run.cli !== 'claude') continue;
		const pane = panes.find(({ name, runnerSocket }) => runnerSocket && name === run.tmux);
		const notice = pane?.screen && trackerQuotaNotice(pane.screen, run.cli);
		if (notice) recordExhaustion(store, { run, cli: run.cli, notice, now });
	}
}

function recordExhaustion(
	store: TrackerPersistenceService,
	{
		run,
		cli,
		notice,
		now
	}: { run: TrackerRunReceipt; cli: WatchdogCli; notice: string; now: number }
) {
	// Remember each run's notice, even during a hold, so clearing is not undone by old screen text.
	const evidenceKey = `autolaunch_quota_evidence_${cli}:${run.id}`;
	const evidence = createHash('sha256').update(notice).digest('hex');
	if (store.getMeta(evidenceKey) === evidence) return;
	if (trackerQuotaHold(store, cli)) {
		store.writeMeta({ [evidenceKey]: evidence });
		return;
	}
	store.writeMeta({ [evidenceKey]: evidence, [holdKey(cli)]: new Date(now).toISOString() });
	const reason = `${cli} quota exhausted on ${store.node}; new ${cli} starts are held. After verifying quota is back, run tracker autolaunch clear-quota ${cli} on ${store.node}.`;
	recordWatchdogAlert(
		store,
		{ itemId: run.item_id, kind: 'quota-hold', reason, identity: `${run.id}:${evidence}` },
		now
	);
}
