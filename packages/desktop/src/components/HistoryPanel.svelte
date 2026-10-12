<script lang="ts">
	import type { Workspace } from '../lib/stores/workspace.svelte';
	import type { EntityDetail, HistoryEvent } from '../models/Desktop.types';
	import { historyPages } from '../utils/historyPages';
	import { timeLabel } from '../utils/timeLabel';
	let { entity, workspace }: { entity: EntityDetail; workspace: Workspace } = $props();
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

<section class="history">
	<h2>Entity history</h2>
	{#each events as event (event.id)}<article>
			<span class="timeline-dot"></span><strong>{event.title}</strong><small
				>{timeLabel(event.at)} {event.commit ? '· ' + event.commit.slice(0, 7) : ''}</small
			>
			<p>{event.detail}</p>
		</article>{:else}<p class="muted">No history recorded for this entity.</p>{/each}
	{#if more}<button
			type="button"
			class="history-more"
			disabled={loading}
			onclick={() => void load()}>Load more history</button
		>{:else if !complete}<p class="muted">Earlier history is not loaded here.</p>{/if}
	{#if error}<p class="error" role="alert">{error}</p>{/if}
</section>
