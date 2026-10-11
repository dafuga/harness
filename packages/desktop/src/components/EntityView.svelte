<script lang="ts">
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import type { Workspace } from '../lib/stores/workspace.svelte';
	import type { ThreadInfo } from '../models/Desktop.types';
	import DesignPanel from './DesignPanel.svelte';
	import ThreadPanel from './ThreadPanel.svelte';
	import ContractPanel from './ContractPanel.svelte';
	import RelationshipsPanel from './RelationshipsPanel.svelte';
	import HistoryPanel from './HistoryPanel.svelte';
	import DetailsPanel from './DetailsPanel.svelte';
	import PlanBadge from './PlanBadge.svelte';
	import StatusIcon from './StatusIcon.svelte';
	import Icon from './Icon.svelte';
	let { workspace }: { workspace: Workspace } = $props();
	let tab = $state(
		typeof location !== 'undefined' && location.pathname.endsWith('/history') ? 'History' : 'Design'
	);
	let details = $state(typeof location !== 'undefined' && location.pathname.endsWith('/details'));
	let conversation = $state(true);
	let thread = $state<ThreadInfo | null>(null);
	let version = $state('');
	const entity = $derived(workspace.entity!);
	onMount(() => {
		if (window.innerWidth <= 850) conversation = false;
	});
	function select(value: ThreadInfo) {
		thread = value;
		conversation = true;
	}
	function historyTab(value: string) {
		tab = value;
		history.replaceState(
			{},
			'',
			workspace.path(entity.category, entity.id, value === 'History' ? 'history' : '')
		);
	}
</script>

<div class="entity-layout" class:with-thread={conversation}>
	<main class="entity-main">
		<a
			class="breadcrumb"
			href={resolve('/harness/[...path]', { path: workspace.path().slice(9) })}
			onclick={(e) => {
				e.preventDefault();
				void workspace.navigate(workspace.path());
			}}>{workspace.category} › {entity.title}</a
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
					history.replaceState(
						{},
						'',
						workspace.path(entity.category, entity.id, details ? 'details' : '')
					);
				}}>Details →</button
			>{#if !conversation}<button onclick={() => (conversation = true)}>Conversation</button>{/if}
		</div>
		<nav class="entity-tabs" aria-label="Entity sections">
			{#each ['Design', 'Contract', 'Relationships', 'History'] as value (value)}<button
					class:active={tab === value}
					onclick={() => historyTab(value)}>{value}</button
				>{/each}
		</nav>
		{#if details}<DetailsPanel {entity} {workspace} />{/if}{#if tab === 'Design'}<DesignPanel
				{entity}
				{workspace}
				bind:version
				onthread={select}
			/><RelationshipsPanel
				relationships={entity.relationships}
				{workspace}
			/>{:else if tab === 'Contract'}<ContractPanel
				contract={entity.contract}
			/>{:else if tab === 'Relationships'}<RelationshipsPanel
				relationships={entity.relationships}
				{workspace}
			/>{:else}<HistoryPanel events={entity.history} />{/if}
	</main>
	{#if conversation}<ThreadPanel
			{entity}
			{workspace}
			bind:thread
			bind:version
			close={() => (conversation = false)}
		/>{/if}
</div>
