<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import type { Workspace } from '../lib/stores/workspace.svelte';
	import type { ThreadInfo } from '../models/Desktop.types';
	import type { ThreadTarget } from '../utils/threadAnchor';
	import DesignPanel from './DesignPanel.svelte';
	import ThreadPanel from './ThreadPanel.svelte';
	import ContractPanel from './ContractPanel.svelte';
	import RelationshipsPanel from './RelationshipsPanel.svelte';
	import HistoryPanel from './HistoryPanel.svelte';
	import DetailsPanel from './DetailsPanel.svelte';
	import MeasuresPanel from './MeasuresPanel.svelte';
	import PlanBadge from './PlanBadge.svelte';
	import StatusIcon from './StatusIcon.svelte';
	import Icon from './Icon.svelte';
	import WorkspaceLink from './WorkspaceLink.svelte';
	let { workspace }: { workspace: Workspace } = $props();
	let tab = $state('Design');
	let details = $state(false);
	let conversation = $state(true);
	let thread = $state<ThreadInfo | null>(null);
	let target = $state<ThreadTarget | null>(null);
	let version = $state('');
	const entity = $derived(workspace.entity!);
	const agents = $derived(workspace.capabilities.agents && Boolean(workspace.snapshot?.writable));
	const annotatable = $derived(agents || workspace.capabilities.comments);
	/** The address opens History or Details; a tab chosen on the page is not taken back. */
	$effect(() => {
		const suffix = workspace.suffix;
		untrack(() => {
			if (suffix === 'history') tab = 'History';
			if (suffix === 'details') details = true;
		});
	});
	onMount(() => {
		if (window.innerWidth <= 850) conversation = false;
	});
	function select(value: ThreadInfo) {
		thread = value;
		target = null;
		conversation = true;
	}
	/**
	 * Where agents may run, a selection opens a planning thread as before. Elsewhere it only aims
	 * the next comment at that image: nothing is written until a person sends one.
	 */
	async function annotate(value: ThreadTarget) {
		if (!agents) {
			thread = null;
			target = value;
			conversation = true;
			return;
		}
		const opened = await workspace.bridge!.openThread({
			entityId: entity.id,
			...value,
			...workspace.context
		});
		await workspace.refresh();
		select(opened);
	}
	function section(suffix: string) {
		history.replaceState({}, '', workspace.path(entity.category, entity.id, suffix));
	}
</script>

<div class="entity-layout" class:with-thread={conversation}>
	<main class="entity-main">
		<WorkspaceLink {workspace} to={workspace.path()} class="breadcrumb"
			>{workspace.category} › {entity.title}</WorkspaceLink
		>
		<div class="entity-heading">
			<span class="entity-symbol"><Icon name={entity.category} size={30} /></span>
			<div>
				<div class="row">
					<h1>{entity.title}</h1>
					<span class="chip">{entity.kind}</span>{#if entity.hasPlan}<PlanBadge />{/if}<StatusIcon
						status={entity.verification}
						reason={entity.verificationNote}
					/>
				</div>
				<p>{entity.summary}</p>
			</div>
			<button
				onclick={() => {
					details = !details;
					section(details ? 'details' : '');
				}}>Details →</button
			>{#if !conversation}<button onclick={() => (conversation = true)}>Conversation</button>{/if}
		</div>
		<nav class="entity-tabs" aria-label="Entity sections">
			{#each ['Design', 'Contract', 'Relationships', 'History'] as value (value)}<button
					class:active={tab === value}
					onclick={() => {
						tab = value;
						section(value === 'History' ? 'history' : '');
					}}>{value}</button
				>{/each}
		</nav>
		{#if details}<DetailsPanel {entity} {workspace} />{/if}{#if tab === 'Design'}<DesignPanel
				{entity}
				{workspace}
				{annotatable}
				bind:version
				onthread={select}
				onannotate={annotate}
			/>{#if entity.category === 'pages'}<RelationshipsPanel
					relationships={entity.relationships}
					{workspace}
				/>{:else}<div class="base-panels">
					<ContractPanel contract={entity.contract} /><MeasuresPanel
						size={entity.size}
						performance={entity.performance}
					/><RelationshipsPanel relationships={entity.relationships} {workspace} />
				</div>{/if}{:else if tab === 'Contract'}<ContractPanel
				contract={entity.contract}
			/>{:else if tab === 'Relationships'}<RelationshipsPanel
				relationships={entity.relationships}
				{workspace}
			/>{:else}<HistoryPanel {entity} {workspace} />{/if}
	</main>
	{#if conversation}<ThreadPanel
			{entity}
			{workspace}
			bind:thread
			bind:target
			bind:version
			close={() => (conversation = false)}
		/>{/if}
</div>
