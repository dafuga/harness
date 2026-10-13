<script lang="ts">
	import { onDestroy, onMount, untrack } from 'svelte';
	import { explorerAppRoute, explorerName } from '../../../reports/src/utils/explorerName';
	import { createEntityEvidenceStore } from '../lib/stores/entityEvidence.svelte';
	import type { Workspace } from '../lib/stores/workspace.svelte';
	import type { ThreadInfo } from '../models/Desktop.types';
	import { evidenceQuery } from '../utils/evidenceQuery';
	import { evidenceVerdict } from '../utils/evidenceVerdict';
	import { createdThread } from '../utils/createdThread';
	import type { ThreadTarget } from '../utils/threadAnchor';
	import CoveragePanel from './CoveragePanel.svelte';
	import DesignPanel from './DesignPanel.svelte';
	import ThreadPanel from './ThreadPanel.svelte';
	import ContractPanel from './ContractPanel.svelte';
	import RelationshipsPanel from './RelationshipsPanel.svelte';
	import HistoryPanel from './HistoryPanel.svelte';
	import DetailsPanel from './DetailsPanel.svelte';
	import MeasuresPanel from './MeasuresPanel.svelte';
	import PlanBadge from './PlanBadge.svelte';
	import RuntimeEvidence from './RuntimeEvidence.svelte';
	import StatusIcon from './StatusIcon.svelte';
	import Icon from './Icon.svelte';
	import WorkspaceLink from './WorkspaceLink.svelte';
	let { workspace }: { workspace: Workspace } = $props();
	/**
	 * Each section with the end of its address; the overview is the address of the entity. An
	 * address no section has, as the former one of both lists, shows the overview that holds them.
	 */
	const sections = {
		Overview: '',
		Designs: 'designs',
		Plan: 'plan',
		'Used In': 'used-in',
		Uses: 'uses',
		Evidence: 'evidence',
		History: 'history'
	} as const;
	type Section = keyof typeof sections;
	/** A function has a plan and no designs; every other entity has designs and no plan section. */
	const headless = $derived(workspace.entity?.category === 'functions');
	const names = $derived(
		(Object.keys(sections) as Section[]).filter((name) => name !== (headless ? 'Designs' : 'Plan'))
	);
	let tab = $state<Section>('Overview');
	let details = $state(false);
	let conversation = $state(true);
	let thread = $state<ThreadInfo | null>(null);
	let target = $state<ThreadTarget | null>(null);
	let version = $state('');
	const entity = $derived(workspace.entity!);
	const agents = $derived(workspace.capabilities.agents && Boolean(workspace.snapshot?.writable));
	const annotatable = $derived(agents || workspace.capabilities.comments);
	/**
	 * The address decides what is shown each time it is read, also when the entity stays the
	 * same: the section it names, or the overview when it names none. Details is open only at its
	 * own address, over the section it was opened on. A section chosen on the page writes its
	 * address, so reading the address again does not take it back.
	 */
	$effect(() => {
		const read = { suffix: workspace.suffix, entity: workspace.entity };
		untrack(() => {
			details = read.suffix === 'details';
			// The former address of the designs of a function opens its plan.
			const asked = headless && read.suffix === 'designs' ? 'plan' : (read.suffix ?? '');
			if (!details) tab = names.find((name) => sections[name] === asked) ?? 'Overview';
		});
	});
	/** Words for the name; a route address is a fact of a page, never its name. */
	const name = $derived(explorerName(entity));
	const route = $derived(
		explorerAppRoute({
			kind: entity.kind,
			title: entity.title,
			owns: { source: entity.sources, symbols: [] }
		})
	);
	/**
	 * Recorded evidence is read where it is shown, and again when the entity, the revision or the
	 * pinned notes and evidence of the project change. Designs are read without it.
	 */
	const evidence = createEntityEvidenceStore();
	$effect(() => {
		const pin = workspace.snapshot?.cache?.identity;
		const stamp = `${pin?.notesRevision ?? ''}|${pin?.evidenceRevision ?? ''}`;
		const scope = evidenceQuery(workspace, workspace.entity?.id ?? '');
		const planned = Boolean(workspace.entity?.planned);
		if (tab === 'Overview' || tab === 'Evidence')
			evidence.show(workspace.bridge, { scope, planned, stamp });
	});
	onDestroy(() => evidence.reset());
	/** The mark beside the name: the verdict of the record that was read, or why there is none. */
	const verdict = $derived(
		evidenceVerdict(evidence, entity, workspace.snapshot?.revision.commit ?? '')
	);
	onMount(() => {
		if (window.innerWidth <= 850) conversation = false;
		const created = createdThread(workspace, entity);
		if (created) select(created);
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
			>{workspace.category} › {name}</WorkspaceLink
		>
		<div class="entity-heading">
			<span class="entity-symbol"><Icon name={entity.category} size={30} /></span>
			<div>
				<div class="row">
					<h1>{name}</h1>
					<span class="chip">{entity.kind}</span>{#if entity.hasPlan}<PlanBadge />{/if}<StatusIcon
						status={verdict.status}
						reason={verdict.reason}
					/>
				</div>
				<p>{entity.summary}</p>
				{#if route}<p class="app-route"><span>App route</span><code>{route}</code></p>{/if}
			</div>
			<button
				onclick={() => {
					details = !details;
					section(details ? 'details' : sections[tab]);
				}}>Details →</button
			>{#if !conversation}<button onclick={() => (conversation = true)}>Conversation</button>{/if}
		</div>
		<nav class="entity-tabs" aria-label="Entity sections">
			{#each names as value (value)}<button
					class:active={tab === value}
					aria-current={tab === value ? 'page' : undefined}
					onclick={() => {
						tab = value;
						details = false;
						section(sections[value]);
					}}>{value}</button
				>{/each}
		</nav>
		{#if details}<DetailsPanel {entity} {workspace} />{/if}{#if tab === 'Overview'}<div
				class="base-panels"
			>
				<ContractPanel contract={entity.contract} /><MeasuresPanel
					size={entity.size}
					performance={entity.performance}
				/>
				<div class="usage-panels">
					<RelationshipsPanel
						relationships={entity.relationships}
						{workspace}
						direction="used-by"
					/>
					<RelationshipsPanel relationships={entity.relationships} {workspace} direction="uses" />
				</div>
			</div>
			<RuntimeEvidence
				{entity}
				{workspace}
				{evidence}
			/>{:else if tab === 'Designs' || tab === 'Plan'}<DesignPanel
				{entity}
				{workspace}
				{annotatable}
				bind:version
				onthread={select}
				onannotate={annotate}
			/>{:else if tab === 'Used In' || tab === 'Uses'}<RelationshipsPanel
				relationships={entity.relationships}
				{workspace}
				direction={tab === 'Uses' ? 'uses' : 'used-by'}
			/>{:else if tab === 'Evidence'}<CoveragePanel {entity} {evidence} />{:else}<HistoryPanel
				{entity}
				{workspace}
			/>{/if}
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
