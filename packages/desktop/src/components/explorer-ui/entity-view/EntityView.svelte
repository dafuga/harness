<!-- @harness-tier organism -->
<!-- @harness-atoms ../../../../../reports/src/components/shared-primitives/atoms -->
<script lang="ts">
	import type { Section } from './EntityView.types';

	import { onDestroy, onMount, untrack } from 'svelte';
	import { explorerAppRoute, explorerName } from '../../../../../reports/src/utils/explorerName';
	import { createEntityEvidenceStore } from '../../../lib/stores/explorer-ui/entityEvidence.svelte';
	import type { Workspace } from '../../../lib/stores/projects-sessions/workspace.svelte';
	import type { ThreadInfo } from '../../../models/development-tooling/Desktop.types';
	import { evidenceQuery } from '../../../utils/verification-evidence/evidenceQuery';
	import { evidenceVerdict } from './evidenceVerdict';
	import { createdThread } from './createdThread';
	import { versionOption } from './threadAnchor';
	import { type ThreadTarget } from '../../../utils/explorer-ui/threadAnchor';
	import CoveragePanel from '../../shared-primitives/CoveragePanel.svelte';
	import DesignPanel from '../../planning-collaboration/design-panel/DesignPanel.svelte';
	import ThreadPanel from '../thread-panel/ThreadPanel.svelte';
	import ContractPanel from '../../shared-primitives/ContractPanel.svelte';
	import RelationshipsPanel from '../../shared-primitives/RelationshipsPanel.svelte';
	import HistoryPanel from '../../git-source-history/history-panel/HistoryPanel.svelte';
	import DetailsPanel from '../../shared-primitives/DetailsPanel.svelte';
	import MeasuresPanel from '../../shared-primitives/MeasuresPanel.svelte';
	import PlanBadge from '../../planning-collaboration/PlanBadge.svelte';
	import RuntimeEvidence from '../../verification-evidence/RuntimeEvidence.svelte';
	import StatusIcon from '../../shared-primitives/StatusIcon.svelte';
	import Icon from '../../shared-primitives/Icon.svelte';
	import WorkspaceLink from '../../projects-sessions/WorkspaceLink.svelte';
	import EntityExamples from '../../../../../reports/src/components/EntityExamples.svelte';
	import { workspaceSections as sections } from '../../../utils/projects-sessions/workspaceRoute';
	let { workspace }: { workspace: Workspace } = $props();
	/** A function has a plan and no designs; every other entity has designs and no plan section. */
	const headless = $derived(workspace.entity?.category === 'functions');
	/** A component keeps its runtime evidence between its name and every section it opens. */
	const pictured = $derived(workspace.entity?.category === 'components');
	const visual = $derived(
		['pages', 'components', 'layouts'].includes(workspace.entity?.category ?? '')
	);
	const names = $derived(
		(Object.keys(sections) as Section[]).filter(
			(name) =>
				name !== (headless ? 'Designs' : 'Plan') &&
				name !== (visual ? 'Evidence' : 'States') &&
				name !== (headless ? 'Evidence' : 'Examples')
		)
	);
	let tab = $state<Section>('Overview');
	let conversation = $state(true);
	let thread = $state<ThreadInfo | null>(null);
	let target = $state<ThreadTarget | null>(null);
	let version = $state('');
	let option = $state('');
	const entity = $derived(workspace.entity!);
	const shown = $derived(versionOption(entity.versions, version, option));
	/** Another project, revision, entity or version shows its open thread's option, if any. */
	$effect(() => {
		void [workspace.projectId, workspace.snapshot?.revision.commit, entity.id, version];
		untrack(() => (option = thread?.version === version ? (thread.option ?? '') : ''));
	});
	const agents = $derived(workspace.capabilities.agents && Boolean(workspace.snapshot?.writable));
	const annotatable = $derived(agents || workspace.capabilities.comments);
	/** Read the addressed section again when the scope or entity changes. */
	$effect(() => {
		const read = { suffix: workspace.suffix, entity: workspace.entity };
		untrack(() => {
			// The former address of the designs of a function opens its plan.
			let asked = read.suffix === 'details' ? 'source' : (read.suffix ?? '');
			if (headless && asked === 'designs') asked = 'plan';
			if (visual && asked === 'evidence') asked = 'states';
			if (headless && asked === 'evidence') asked = 'examples';
			tab = names.find((name) => sections[name] === asked) ?? 'Overview';
		});
	});
	const name = $derived(explorerName(entity));
	const route = $derived(
		explorerAppRoute({
			kind: entity.kind,
			title: entity.title,
			owns: { source: entity.sources, symbols: [] }
		})
	);
	/** Read evidence where shown; discard answers for superseded scopes. */
	const evidence = createEntityEvidenceStore();
	$effect(() => {
		const pin = workspace.snapshot?.cache?.identity;
		const stamp = `${pin?.notesRevision ?? ''}|${pin?.evidenceRevision ?? ''}`;
		const scope = evidenceQuery(workspace, workspace.entity?.id ?? '');
		const planned = Boolean(workspace.entity?.planned);
		if (
			pictured ||
			tab === 'Overview' ||
			tab === 'Evidence' ||
			tab === 'Examples' ||
			tab === 'States' ||
			tab === 'History'
		)
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
		[thread, target, conversation] = [value, null, true];
		if (value.version === version && value.option) option = value.option;
	}
	/** A selection opens an agent thread or aims the next hosted comment. */
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

<hx-div class="entity-layout" class:with-thread={conversation}>
	<hx-main class="entity-main">
		<WorkspaceLink {workspace} to={workspace.path()} class="breadcrumb"
			>{workspace.category} › {name}</WorkspaceLink
		>
		<hx-div class="entity-heading">
			<hx-span class="entity-symbol"><Icon name={entity.category} size={30} /></hx-span>
			<hx-div>
				<hx-div class="row">
					<hx-h1>{name}</hx-h1>
					<hx-span class="chip">{entity.kind}</hx-span>{#if entity.hasPlan}<PlanBadge
						/>{/if}<StatusIcon status={verdict.status} reason={verdict.reason} />
				</hx-div>
				<hx-p>{entity.summary}</hx-p>
				{#if route}<hx-p class="app-route"
						><hx-span>App route</hx-span><hx-code>{route}</hx-code></hx-p
					>{/if}
			</hx-div>
			{#if !conversation}<hx-button onclick={() => (conversation = true)}>Conversation</hx-button
				>{/if}
		</hx-div>
		{#if pictured}<RuntimeEvidence {entity} {workspace} {evidence} />{/if}
		<hx-nav class="entity-tabs" aria-label="Entity sections">
			{#each names as value (value)}<hx-button
					class:active={tab === value}
					aria-current={tab === value ? 'page' : undefined}
					onclick={() => {
						tab = value;
						section(sections[value]);
					}}>{value}</hx-button
				>{/each}
		</hx-nav>
		{#if tab === 'Source'}
			{#key `${entity.id}:${workspace.snapshot?.revision.commit}`}<DetailsPanel
					{entity}
					{workspace}
				/>{/key}
		{:else if tab === 'Overview'}<hx-div class="base-panels">
				<ContractPanel contract={entity.contract} /><MeasuresPanel
					size={entity.size}
					performance={entity.performance}
				/>
				<hx-div class="usage-panels">
					<RelationshipsPanel
						relationships={entity.relationships}
						{workspace}
						direction="used-by"
					/>
					<RelationshipsPanel relationships={entity.relationships} {workspace} direction="uses" />
				</hx-div>
			</hx-div>
			{#if !pictured}<RuntimeEvidence {entity} {workspace} {evidence} />{/if}
		{:else if tab === 'Designs' || tab === 'Plan'}<DesignPanel
				{entity}
				{workspace}
				{annotatable}
				bind:version
				bind:option={() => shown, (value) => (option = value)}
				onthread={select}
				onannotate={annotate}
			/>{:else if tab === 'Used In' || tab === 'Uses'}<RelationshipsPanel
				relationships={entity.relationships}
				{workspace}
				direction={tab === 'Uses' ? 'uses' : 'used-by'}
			/>{:else if tab === 'Examples'}<EntityExamples documentation={entity.documentation} />
			<CoveragePanel {entity} {evidence} {workspace} />
		{:else if tab === 'Evidence' || tab === 'States'}<CoveragePanel
				{entity}
				{evidence}
				{workspace}
			/>{:else}<HistoryPanel {entity} {workspace} {evidence} />{/if}
	</hx-main>
	{#if conversation}<ThreadPanel
			{entity}
			{workspace}
			bind:thread
			bind:target
			bind:version
			bind:option={() => shown, (value) => (option = value)}
			close={() => (conversation = false)}
		/>{/if}
</hx-div>
