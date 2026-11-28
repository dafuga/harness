// @harness-uid u_bl6xl2h4a3
import type { TrackerItem } from '../../../repositories/projects-sessions/TrackerItemReadRepository.types';

import { TrackerItemReadRepository } from '../../../repositories/projects-sessions/TrackerItemReadRepository';
import { TrackerItemReadError } from '../../../repositories/projects-sessions/tracker-item-read-repository/TrackerItemReadError';
import { TrackerRunReadRepository } from '../../../repositories/projects-sessions/TrackerRunReadRepository';
import type { TrackerPersistenceService } from '../TrackerPersistenceService';
import type { TrackerRunReceipt } from '../../agents-providers/TrackerDispatcherService.types';
import type { TrackerHostTarget } from './trackerHostLaunch.types';
import { floorReasons, projectOf } from '../../../utils/agents-providers/classifyTrackerTask';
import { sanitizeTrackerText } from '../../../utils/projects-sessions/sanitizeTrackerText';
import {
	TrackerSessionRuleRepository,
	trackerRecentRuleCount
} from '../../../repositories/projects-sessions/TrackerSessionRuleRepository';
import type { TrackerSessionRule } from '../../../repositories/projects-sessions/TrackerSessionRuleRepository.types';
import { trackerAskOptionsRule } from './trackerAskOptionsRule';
import { trackerAutomationBrowserRule } from './trackerAutomationBrowserRule';
import { trackerDoneProofRule } from './trackerDoneProofRule';
import { trackerSecretSafetyRule } from './trackerSecretSafetyRule';
import { trackerCpuBudgetRule } from '../../../utils/projects-sessions/trackerCpuBudget';
import { trackerContextCheckpointPrefix } from './trackerWatchdogContext';

const launchRules = [
	'Never merge into a Greymass repository. For Greymass work, stop at the pull request.',
	'For other repositories, work on a branch and open a PR within the task scope. Merge only if Daniel explicitly authorized the PR and target on this item, or the standing authorization for Harness PRs covers this merge. Follow the item restrictions and required checks.',
	'A production deploy or promotion, including a merge that deploys to production, requires Daniel’s explicit approval for the specific release.',
	'Before raising a problem or asking Daniel, run `tracker check "<topic>"`. Reuse any existing item. If the topic is ignored, do not raise it again.',
	'',
	'## Tests',
	'Add or update relevant tests for each change and run them before tracker done. Fix failures or record the blocker.',
	'Run only the tests relevant to your change. Run focused unit and E2E tests for changed modules and their dependents, and typecheck and lint the changed files.',
	'Reuse GitHub CI results when available. Run the full suite once per combined release.',
	'For a portable CPU-heavy suite, use `tracker host-work ssh auto -- <command>` to select a Mac with CPU and RAM headroom. Use absolute paths available on either eligible Mac. Follow any suite-specific host restriction.',
	'For heavy suites with a required host, use `harness resources run --heavy-test -- <command>` on that computer.',
	'',
	'## Video evidence',
	'If the task asks for a video, deliver a screen recording of the real app.',
	'Extract and inspect frames that show the requested flow. In the acceptance evidence, list the timestamp of each extracted frame and describe what it shows.'
].join('\n');

export function formatTrackerHostBrief(
	item: TrackerItem,
	completion: string,
	{
		recovery = false,
		cpuBudget,
		launch,
		rules = []
	}: { recovery?: boolean; cpuBudget?: number; launch?: string; rules?: TrackerSessionRule[] } = {}
): string {
	const id = item.id.slice(0, 6);
	const risks = floorReasons(item);
	const notes = item.notes_log.slice(-10).map(({ at, text }) => `- ${at} ${text.slice(0, 1200)}`);
	return [
		trackerSecretSafetyRule,
		'',
		trackerSessionRulesBrief(rules),
		'',
		trackerAskOptionsRule,
		'',
		trackerAutomationBrowserRule,
		'',
		'## Work on another computer',
		'Wrap remote checks and builds in `tracker host-work ssh <computer> -- ssh <host> <command>` so their load appears on the executing computer.',
		'Use `tracker host-work colima <computer> -- ssh <host> <proof-script>` for Colima proofs. Keep VM startup, verification and task-owned teardown within the foreground script.',
		'',
		launchRules,
		'',
		`# ${item.title}`,
		'',
		`Tracker item ${id} (full ID ${item.id}).`,
		'',
		cpuBudget && trackerCpuBudgetRule(cpuBudget),
		item.agent === 'harness' &&
			`Submit commits with \`bun run check --item ${id}\` for affected checks. Use the same host queue with \`--release\` for the combined release and never start the full check directly.`,
		risks.length > 0 &&
			`Handle with care: ${risks.join(', ')}. Double-check changes, keep credentials out of output and obtain Daniel’s approval before anything irreversible.`,
		launch,
		item.adapter_instructions && `## Source instructions\n\n${item.adapter_instructions}`,
		item.notes && `## Task\n\n${item.notes.slice(0, 32000)}`,
		notes.length > 0 && `## Recent notes\n\n${notes.join('\n')}`,
		...trackerResumeLines(item, recovery),
		trackerAnswerBrief(item),
		`Start by running \`tracker start ${id}\`.`,
		'Keep working through verification. Pause when the task is done, a true blocker prevents further work, or you file a context checkpoint.',
		`At 150,000 active context tokens, run tracker note ${id} with a note starting "${trackerContextCheckpointPrefix}". Include the exact worktree, branch, completed work, pending checks and next step. Leave the item in progress and pause at the idle prompt. Tracker will continue the same item with the same model in a fresh session.`,
		'',
		completion,
		'',
		trackerDoneProofRule
	]
		.filter((line) => line !== null && line !== undefined && line !== false)
		.join('\n');
}
export function trackerHostRules(store: TrackerPersistenceService): TrackerSessionRule[] {
	return new TrackerSessionRuleRepository(store.database).list().slice(0, trackerRecentRuleCount);
}

function trackerSessionRulesBrief(rules: TrackerSessionRule[]): string {
	return [
		'## Session rules',
		'Read the current rule set with `tracker rule list` before acting. Tracker syncs these rules between computers.',
		'When an incident calls for a durable rule, record it with `tracker rule add "<rule>" --from <incident> --skill <name>`.',
		'Read the relevant installed skills before the action. In Claude, use `~/.claude/skills`; in Codex, use `~/.codex/skills`.',
		'Read `secret-safe-computer-use/SKILL.md` before credential work and `computer-hygiene/SKILL.md` before using browsers, apps, simulators or background processes.',
		...rules.map(({ incident, skill, text }) => `- [${skill}, incident ${incident}] ${text}`)
	].join('\n');
}

function trackerResumeLines(item: TrackerItem, recovery: boolean) {
	if (!recovery) return [];
	const handoff = item.notes_log
		.filter(({ text }) => /^stopped:.*?\bresume from\s*:/is.test(text))
		.at(-1);
	return [
		handoff && `## Last handoff\n\n${handoff.text.slice(0, 4000)}`,
		item.needs_daniel &&
			!item.resolved &&
			'An unanswered Tracker question remains open. Continue independent work and preserve any approval gates.'
	];
}

function trackerAnswerBrief(item: TrackerItem) {
	if (!item.resolved || item.needs_daniel || !item.answered_at) return undefined;
	return 'A Tracker answer is recorded. Read the current answer on the item and continue as directed. Handle credentials through the approved private path.';
}

/** Resolve a full or abbreviated parent without preventing a launch for a missing reference. */
function trackerBriefParent(
	store: TrackerPersistenceService,
	item: TrackerItem,
	run: TrackerRunReceipt
) {
	if (!item.parent || run.launch_source === 'due') return undefined;
	try {
		const parent = new TrackerItemReadRepository(store.database).resolve(item.parent);
		return `## Parent\n\n${parent.kind} ${parent.id}: ${sanitizeTrackerText(parent.title ?? '')}\n${sanitizeTrackerText(parent.notes ?? '').slice(0, 1200)}\nRead the full parent with \`tracker show ${parent.id}\`.`;
	} catch (error) {
		if (error instanceof TrackerItemReadError)
			return `Parent reference: ${item.parent} (unresolved).`;
		throw error;
	}
}

export function trackerLaunchContext(
	store: TrackerPersistenceService,
	item: TrackerItem,
	run: TrackerRunReceipt,
	route: TrackerHostTarget
) {
	const history = new TrackerRunReadRepository(store.database, store.node).list({
		itemId: item.id
	});
	const parent = trackerBriefParent(store, item, run);
	const earlier = history.filter(
		(entry) =>
			entry.state === 'finished' &&
			(entry.node === run.node
				? entry.id < run.id
				: (entry.ended_at ?? entry.queued_at ?? 0) <= run.queued_at)
	);
	const lines = [
		`Run ${run.id}, attempt ${run.attempt} on ${run.node}. Rung: ${run.rung}. Model: ${run.model}${run.effort ? ' ' + run.effort : ''}.`,
		`Project: ${projectOf(item) ?? '(none)'}. ${'repo' in route ? 'Source repo: ' + route.repo : 'Working directory: ' + route.workdir}.${item.due ? ' Due: ' + item.due + '.' : ''}`
	];
	if (earlier.length) {
		lines.push(
			'## Earlier attempts',
			...earlier
				.slice(-10)
				.map(
					(entry) =>
						`- run ${entry.id} on ${entry.node} (${entry.rung}): ${entry.outcome ?? 'finished'}${entry.failure_reason ? ' (' + sanitizeTrackerText(entry.failure_reason).slice(0, 240) + ')' : ''}`
				),
			`Check earlier attempts for branches, uncommitted changes and open PRs. Continue sound work. Read the full run history with \`tracker show ${item.id} --json\`.`
		);
	}
	if (parent) lines.push(parent);
	return lines.join('\n');
}
