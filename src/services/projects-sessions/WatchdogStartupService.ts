// @harness-uid u_yz3ar5ts6w
import { WatchdogPaneService } from './WatchdogPaneService';
import type {
	StartupDialog,
	WatchdogItem,
	WatchdogPane,
	WatchdogRun
} from './WatchdogPaneService.types';
import type {
	StartupAlert,
	StartupCandidates,
	StartupDecision,
	StartupPlan,
	StartupScan,
	StartupTrustEvidence
} from './WatchdogStartupService.types';

function answerPending(row: WatchdogItem): boolean {
	return Boolean(row.needsDaniel && !row.resolved);
}

function eligibleItem(row: WatchdogItem, itemId: string | undefined, managed: boolean): boolean {
	return (
		!row.deleted &&
		(!itemId || row.id === itemId) &&
		(row.status === 'in_progress' || (managed && row.status === 'open'))
	);
}

function alertDecision(
	pane: WatchdogPane,
	row: WatchdogItem,
	prompt: StartupDialog,
	context: { host: string; prior?: StartupAlert }
): StartupDecision {
	const { cli, kind } = prompt;
	const { host, prior } = context;
	const provider = cli === 'codex' ? 'Codex' : 'Claude Code';
	const reason = `${provider} is waiting at its ${kind} prompt in ${pane.name}. Chief of Staff, please inspect the pane and resolve the prompt.`;
	const identity = `${pane.key}:${cli}:${kind}`;
	const question = `${host}: ${reason}`;
	const ownsQuestion = prior && row.question === `${host}: ${prior.reason}`;
	return {
		id: row.id,
		pane: pane.name,
		paneKey: pane.key,
		kind,
		action: 'alert',
		reason,
		identity,
		writeAlert: prior?.identity !== identity,
		question: row.question !== question && (!answerPending(row) || ownsQuestion) ? question : null
	};
}

function clearedAlerts(
	scan: StartupScan,
	candidates: StartupCandidates
): StartupPlan['clearAlerts'] {
	return [...candidates.previous.values()]
		.filter(({ id }) => !candidates.pending.has(id) && (!scan.itemId || id === scan.itemId))
		.map(({ id, reason }) => {
			const row = candidates.items.get(id);
			const clearQuestion = Boolean(
				row && !row.deleted && answerPending(row) && row.question === `${scan.host}: ${reason}`
			);
			return { id, clearQuestion };
		});
}

export class WatchdogStartupService {
	private readonly panes = new WatchdogPaneService();

	/** Trust is a proposal. The caller must claim and revalidate the run, worktree and current dialog. */
	plan(input: StartupScan): StartupPlan {
		const candidates: StartupCandidates = {
			items: new Map(input.items.map((item) => [item.id, item])),
			running: new Map(
				input.runs.filter((run) => run.state === 'running').map((run) => [run.tmux, run])
			),
			previous: new Map(input.previousAlerts?.map((alert) => [alert.id, alert])),
			pending: new Set(),
			actions: new Map()
		};
		for (const pane of input.panes) this.visitPane(pane, input, candidates);
		return {
			actions: [...candidates.actions.values()],
			clearAlerts: clearedAlerts(input, candidates)
		};
	}

	private visitPane(pane: WatchdogPane, input: StartupScan, candidates: StartupCandidates): void {
		if (!pane.live) return;
		const run = pane.runnerSocket ? candidates.running.get(pane.name) : undefined;
		const row = run ? candidates.items.get(run.itemId) : this.panes.manualItem(pane, input.items);
		if (!row || !eligibleItem(row, input.itemId, Boolean(run))) return;
		const prompt = this.pendingPrompt(pane, input.host, candidates, { row, run });
		if (!prompt) return;
		candidates.pending.add(row.id);
		const trust = this.trustDecision(pane, row, prompt, { input, run });
		candidates.actions.set(
			row.id,
			trust ??
				alertDecision(pane, row, prompt, {
					host: input.host,
					prior: candidates.previous.get(row.id)
				})
		);
	}

	private pendingPrompt(
		pane: WatchdogPane,
		host: string,
		candidates: StartupCandidates,
		context: { row: WatchdogItem; run?: WatchdogRun }
	): StartupDialog | null {
		const { row, run } = context;
		const prompt = this.panes.startupPrompt(pane);
		if (prompt === undefined) candidates.pending.add(row.id);
		if (
			!prompt ||
			(run && run.cli !== prompt.cli) ||
			candidates.actions.has(row.id) ||
			this.panes.isStopped(pane, row.notes ?? [], host, prompt.cli)
		)
			return null;
		return prompt;
	}

	private trustDecision(
		pane: WatchdogPane,
		row: WatchdogItem,
		prompt: StartupDialog,
		context: { input: StartupScan; run?: WatchdogRun }
	): StartupDecision | null {
		const { input, run } = context;
		if (
			!run ||
			prompt.kind !== 'folder trust' ||
			!prompt.confirmable ||
			answerPending(row) ||
			!this.canTrust(run, pane, input.now, input.trustByRun?.get(run.id))
		)
			return null;
		return {
			id: row.id,
			pane: pane.name,
			paneKey: pane.key,
			runId: run.id,
			kind: 'folder trust',
			action: 'trust'
		};
	}

	private canTrust(
		run: WatchdogRun,
		pane: WatchdogPane,
		now: number,
		proof?: StartupTrustEvidence
	): boolean {
		return Boolean(
			proof?.ownedBySourceRepo &&
			!proof.alreadyAttempted &&
			pane.cwd === proof.canonicalRepo &&
			run.startedAt != null &&
			!run.resumedAt &&
			now >= run.startedAt &&
			now - run.startedAt < 120_000
		);
	}
}
