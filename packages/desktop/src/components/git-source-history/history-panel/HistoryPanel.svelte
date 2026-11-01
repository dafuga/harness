<!-- @harness-tier organism -->
<!-- @harness-atoms ../../../../../reports/src/components/shared-primitives/atoms -->
<script lang="ts">
	import { shortCommit } from '$reports/helpers/strings/shortCommit';

	import type { Workspace } from '../../../lib/stores/projects-sessions/workspace.svelte';
	import type {
		EntityDetail,
		HistoryEvent
	} from '../../../models/development-tooling/Desktop.types';
	import { historyPages } from './historyPages';
	import { timeLabel } from '../../../utils/development-tooling/timeLabel';
	import WorkspaceLink from '../../projects-sessions/WorkspaceLink.svelte';
	import RegressionProof from '$shared/verification-evidence/RegressionProof.svelte';
	import LoadingState from '$reports/components/shared-primitives/LoadingState.svelte';
	import type { EntityEvidence } from '../../../lib/stores/explorer-ui/entityEvidence.svelte';
	let {
		entity,
		workspace,
		evidence
	}: { entity: EntityDetail; workspace: Workspace; evidence: EntityEvidence } = $props();
	const proofs = $derived(
		evidence.status === 'ready' ? (evidence.result?.evidence.after.detail?.regressions ?? []) : []
	);
	let later = $state<HistoryEvent[]>([]);
	let next = $state<number | null>(null);
	let complete = $state(true);
	let loading = $state(false);
	let error = $state('');
	/** What the loaded pages belong to; pages of another project, entity or commit are dropped. */
	const view = $derived(
		`${workspace.projectId}|${entity.id}|${workspace.snapshot?.revision.commit}`
	);
	/** An entity without coverage carries its whole history, as local ones always did. */
	$effect(() => {
		const coverage = view && entity.historyCoverage;
		later = [];
		error = '';
		complete = coverage ? coverage.complete : true;
		next = coverage ? coverage.nextPage : null;
	});
	const events = $derived(historyPages(entity.history, later));
	/**
	 * The commits the shown branch is known to contain. Only such a commit of an event is a link:
	 * one of a planning branch, or one this list does not reach, stays text and proves nothing.
	 */
	const contained = $derived(new Set((workspace.snapshot?.commits ?? []).map((item) => item.hash)));
	const there = (commit: string) =>
		workspace.link({
			branch: workspace.snapshot?.revision.branch,
			commit,
			category: entity.category,
			entityId: entity.id
		});
	const more = $derived(!complete && next !== null && Boolean(workspace.bridge?.history));
	async function load() {
		const revision = workspace.snapshot?.revision;
		const asked = view;
		if (!more || next === null || !revision || loading) return;
		loading = true;
		error = '';
		try {
			const page = await workspace.bridge!.history!({
				entityId: entity.id,
				commit: revision.commit,
				branch: revision.branch,
				page: next,
				...workspace.context
			});
			if (asked !== view) return;
			later = [...later, ...page.entries];
			complete = page.complete;
			next = page.nextPage;
		} catch (cause) {
			if (asked === view) error = String(cause);
		} finally {
			loading = false;
		}
	}
</script>

<hx-section class="history" aria-busy={loading}>
	<hx-h2>Entity history</hx-h2>
	<RegressionProof
		items={proofs}
		unit={entity.id}
		href={there}
		follow={(commit) => void workspace.navigate(there(commit))}
	/>
	{#each events as event (event.id)}<hx-article>
			<hx-span class="timeline-dot"></hx-span><hx-strong>{event.title}</hx-strong><hx-small
				>{timeLabel(event.at)}
				{#if event.commit}·
					{#if contained.has(event.commit)}<WorkspaceLink
							{workspace}
							to={there(event.commit)}
							label={`Show at commit ${shortCommit(event.commit)}`}
							>{shortCommit(event.commit)}</WorkspaceLink
						>{:else}{shortCommit(event.commit)}{/if}{/if}</hx-small
			>
			<hx-p>{event.detail}</hx-p>
		</hx-article>{:else}<hx-p class="muted">No history recorded for this entity.</hx-p>{/each}
	{#if loading}<LoadingState inline label="Loading earlier history…" />{/if}
	{#if more}<hx-button
			type="button"
			class="history-more"
			disabled={loading}
			onclick={() => void load()}>Load more history</hx-button
		>{:else if !complete}<hx-p class="muted">Earlier history is not loaded here.</hx-p>{/if}
	{#if error}<hx-p class="error" role="alert">{error}</hx-p>{/if}
</hx-section>
