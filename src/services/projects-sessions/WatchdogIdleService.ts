// @harness-uid u_3jxqtek5x2
import { WatchdogPaneService } from './WatchdogPaneService';
import type { IdleDecision, IdlePlan, IdleScan } from './WatchdogIdleService.types';
import type {
	WatchdogCli,
	WatchdogItem,
	WatchdogPane,
	WatchdogRun
} from './WatchdogPaneService.types';

const minute = 60_000;
const orchestrator = /\borchestrat(?:e|or|ion)\b/i;

function inScope(item: WatchdogItem, itemId?: string): boolean {
	return !itemId || item.id === itemId;
}

function idleEligible(input: IdleScan, row: WatchdogItem): boolean {
	return (
		inScope(row, input.itemId) &&
		!row.deleted &&
		row.status === 'in_progress' &&
		(!row.needsDaniel || Boolean(row.resolved))
	);
}

function beyondIdleThreshold(input: IdleScan, pane: WatchdogPane, run?: WatchdogRun): boolean {
	const latestStart = run?.resumedAt ?? run?.startedAt ?? pane.createdAt;
	const latestActivity = Math.max(pane.activity, run?.idleNudgedAt ?? 0, latestStart);
	return !run?.idleEscalatedAt && input.now - latestActivity > 10 * minute;
}

function abandonedRuns(input: IdleScan, items: ReadonlyMap<string, WatchdogItem>): number[] {
	const live = new Set(input.panes.filter((pane) => pane.live).map((pane) => pane.key));
	return input.runs
		.filter((run) => {
			if (run.state !== 'observed') return false;
			const row = items.get(run.itemId);
			return (
				row &&
				inScope(row, input.itemId) &&
				(!live.has(run.watchPane ?? '') ||
					row.deleted === true ||
					row.status === 'done' ||
					row.status === 'ignored')
			);
		})
		.map((run) => run.id);
}

function idleDecision(
	input: IdleScan,
	context: { pane: WatchdogPane; row: WatchdogItem; run?: WatchdogRun },
	cli: WatchdogCli
): IdleDecision {
	const { pane, row, run } = context;
	const reason = input.quotaHolds?.includes(cli) ? `${cli} quota exhausted on ${input.host}` : null;
	return {
		id: row.id,
		pane: pane.name,
		paneKey: pane.key,
		runId: run?.id ?? null,
		cli,
		action: reason !== null || (run?.idleNudges ?? 0) >= 1 ? 'alert' : 'nudge',
		idleMinutes: Math.floor((input.now - pane.activity) / minute),
		...(reason ? { reason } : {})
	};
}

export class WatchdogIdleService {
	private readonly panes = new WatchdogPaneService();

	/** The caller rechecks item and pane identity before applying any planned decision. */
	plan(input: IdleScan): IdlePlan {
		const items = new Map(input.items.map((item) => [item.id, item]));
		const running = new Map(
			input.runs.filter((run) => run.state === 'running').map((run) => [run.tmux, run])
		);
		const observed = new Map(
			input.runs.filter((run) => run.state === 'observed').map((run) => [run.watchPane, run])
		);
		const candidates = input.panes.flatMap((pane) => {
			const manual = this.panes.isManual(pane);
			if (!pane.live || (!manual && !pane.runnerSocket)) return [];
			const run = manual ? observed.get(pane.key) : running.get(pane.name);
			const row = run ? items.get(run.itemId) : this.panes.manualItem(pane, input.items);
			const decision = row && this.candidate(input, { pane, row, run, manual });
			return decision ? [decision] : [];
		});
		const actions = new Map<string, IdleDecision>();
		for (const { action } of candidates.sort((a, b) => b.priority - a.priority)) {
			if (!actions.has(action.id)) actions.set(action.id, action);
		}
		return { actions: [...actions.values()], abandonRunIds: abandonedRuns(input, items) };
	}

	private candidate(
		input: IdleScan,
		context: { pane: WatchdogPane; row: WatchdogItem; run?: WatchdogRun; manual: boolean }
	): { action: IdleDecision; priority: number } | null {
		const { pane, row, run, manual } = context;
		if (!idleEligible(input, row) || !beyondIdleThreshold(input, pane, run)) return null;
		const cli = this.panes.idlePrompt(pane);
		if (
			!cli ||
			(run && run.cli !== cli) ||
			this.panes.isStopped(pane, row.notes ?? [], input.host, cli)
		)
			return null;
		return {
			action: idleDecision(input, context, cli),
			priority: orchestrator.test(row.title) ? 2 : Number(manual)
		};
	}
}
