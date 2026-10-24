<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { ExplorerEntity } from '../../../models/explorer-ui/Explorer.types';
	import type { ExplorerScreenProps } from '../../../models/explorer-ui/ExplorerScreen.types';
	import type { EntityNav } from '../../../utils/explorer-ui/entityLens';
	import { entityMetricComparison } from '../../../utils/explorer-ui/entityMetricComparison';
	import { entityShown } from './entityShown';
	import { helperRelations } from '../../../utils/explorer-ui/entityShown';
	import EntityContract from '../entity-contract/EntityContract.svelte';
	import EntitySource from '../EntitySource.svelte';
	import EntityOverview from '../EntityOverview.svelte';
	import EntityRelations from '../entity-relations/EntityRelations.svelte';
	import EntityTests from '../entity-tests/EntityTests.svelte';
	import EntityStates from '../EntityStates.svelte';
	import EntityExamples from '../EntityExamples.svelte';
	import EntityAudio from '../EntityAudio.svelte';
	import HarnessIcon from '../HarnessIcon.svelte';
	let {
		host,
		entity,
		nav,
		pane
	}: {
		host: ExplorerScreenProps;
		entity: ExplorerEntity;
		nav: EntityNav;
		/** The evidence an entity of this kind is shown with: above its summary when it is seen. */
		pane: Snippet;
	} = $props();
	let summary = $derived(entityShown(host, entity));
	let comparison = $derived(
		entityMetricComparison(host, entity, summary.measure, host.route.helper)
	);
	let relations = $derived(helperRelations(host, entity, host.lens.relations(entity.id)));
	let usesAvailable = $derived(
		!host.route.helper || entity.category !== 'functions' || relations.functions.length > 0
	);
	const said = { 'used-in': 'used in', uses: 'uses' } as const;
	let direction = $derived(
		(host.route.tab === 'used-in' && entity.category !== 'pages') ||
			(host.route.tab === 'uses' && usesAvailable)
			? host.route.tab
			: null
	);
	let removed = $derived(entity.change === 'removed');
	let visual = $derived(['pages', 'components', 'layouts'].includes(entity.category));
	// Functions and services show their authored uses; their former Tests address opens them too.
	let examples = $derived(
		['functions', 'services'].includes(entity.category) &&
			(host.route.tab === 'examples' || host.route.tab === 'tests')
	);
	// The purpose is the sentence under the name of an overview tab; it is not said twice there.
	let contract = $derived(summary.contract.filter((row) => row.label !== 'Purpose'));
	// A model's tables, from the declaration its title names first as its contract reads them.
	let definitions = $derived.by(() => {
		const all = entity.unit.modelDefinitions ?? [];
		const named = all.filter((item) => item.name === entity.unit.title);
		return named.length > 0 ? named : all;
	});
	let tables = $derived(
		definitions.flatMap(({ name, source, table }) => (table ? [{ name, source, table }] : []))
	);
	let gaps = $derived(
		definitions.flatMap(({ name, tableGap }) => (tableGap ? [{ name, gap: tableGap }] : []))
	);
	let schemaTitle = $derived(entity.lastAt ? `Last table · ${entity.lastAt.slice(0, 7)}` : 'Table');
</script>

<div class="ex-sections" data-harness-component="harness-entity-sections">
	<!-- The tab of the address decides what an entity screen shows; any other shows its overview. -->
	{#if entity.category === 'pages' && (host.route.tab === 'models' || host.route.tab === 'contract')}
		<div role="tabpanel" aria-label={`${entity.name} models`}>
			<EntityRelations {host} {relations} {nav} show="models" {removed} />
		</div>
	{:else if direction}
		<div role="tabpanel" aria-label={`${entity.name} ${said[direction]}`}>
			<EntityRelations {host} {relations} {nav} show={direction} {removed} />
		</div>
	{:else if examples}
		<div role="tabpanel" aria-label={`${entity.name} examples`} class="ex-stack">
			{#if entity.category === 'services'}
				<!-- Creation leads; recorded verification stays apart from authored uses. -->
				<EntityExamples documentation={entity.unit.documentation} setupTitle="Create the service" />
				<p class="ex-soft">These examples are authored documentation, not test results.</p>
				<details><summary>Verification details</summary>{@render verificationPanel()}</details>
			{:else}
				<EntityExamples documentation={entity.unit.documentation} />
			{/if}
		</div>
	{:else if entity.category === 'components' && host.route.tab === 'audio'}
		<div role="tabpanel" aria-label={`${entity.name} audio`}>
			<EntityAudio
				evidence={host.lens.evidence(entity.unit)}
				scope={host.scope}
				mediaBase={host.mediaBase}
				empty
			/>
		</div>
	{:else if host.route.tab === 'states' || host.route.tab === 'tests'}
		{#if visual}
			<div role="tabpanel" aria-label={`${entity.name} states`}>
				<EntityStates
					name={entity.name}
					evidence={host.lens.evidence(entity.unit)}
					scope={host.scope}
					mediaBase={host.mediaBase}
				/>
				<details><summary>Verification details</summary>{@render verificationPanel()}</details>
			</div>
		{:else}{@render verificationPanel()}{/if}
	{:else if host.route.tab === 'source'}
		<div role="tabpanel" aria-label={`${entity.name} source`}>
			<EntitySource
				unit={entity.unit}
				{entity}
				{nav}
				repository={host.index.sourceRepository}
				commit={entity.lastAt ?? host.scope.commit}
			/>
		</div>
	{:else if host.route.tab === 'contract'}
		<div role="tabpanel" aria-label={`${entity.name} contract`}>
			<EntityContract
				unit={entity.unit}
				category={entity.category}
				{contract}
				last={entity.lastAt}
			/>
		</div>
	{:else if entity.category === 'models' && host.route.tab === 'table'}
		<div role="tabpanel" aria-label={`${entity.name} table`}>
			<section class="ex-card" aria-label={entity.lastAt ? 'Last table' : 'Table'}>
				<h2><HarnessIcon name="database" size={24} /> {schemaTitle}</h2>
				{#if entity.lastAt}
					<p class="ex-note">Removed at the shown commit; this is what its parent held.</p>
				{/if}
				{#if tables.length > 0}
					<p class="ex-note">Read from the committed source; no database is queried.</p>
				{/if}
				{#each tables as item, position (position)}
					<div class="schema">
						<h3><code>{item.table.name}</code></h3>
						<p class="ex-note">
							Declared by <code>{item.name}</code> in <code>{item.source}</code>.
						</p>
						<div class="ex-scroll">
							<table class="ex-table" aria-label={`${item.table.name} columns`}>
								<thead>
									<tr>
										<th scope="col">Column</th>
										<th scope="col">Property</th>
										<th scope="col">Type</th>
										<th scope="col">Primary key</th>
										<th scope="col">Nullable</th>
										<th scope="col">Default</th>
									</tr>
								</thead>
								<tbody>
									{#each item.table.columns as column, columnPosition (columnPosition)}
										<tr>
											<td><code>{column.name}</code></td>
											<td><code>{column.property}</code></td>
											<td><code>{column.type}</code></td>
											<td>{column.primaryKey ? 'Yes' : 'No'}</td>
											<td>{column.nullable ? 'Yes' : 'No'}</td>
											<td>{column.default ?? 'None'}</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					</div>
				{/each}
				{#each gaps as item, position (position)}
					<p class="ex-note">The table of <code>{item.name}</code> is unresolved: {item.gap}</p>
				{/each}
				{#if tables.length === 0 && gaps.length === 0}
					<p class="ex-note">This revision records no database table for this model.</p>
				{/if}
			</section>
		</div>
	{:else}
		<EntityOverview {entity} measure={summary.measure} {comparison}>
			{@render pane()}
		</EntityOverview>
	{/if}
</div>

{#snippet verificationPanel()}
	<EntityTests
		{entity}
		scope={host.scope}
		evidence={host.lens.evidence(entity.unit)}
		behavior={host.lens.behavior(entity.unit)}
		{nav}
		mediaBase={host.mediaBase}
		exportHref={host.exportHref}
	/>
{/snippet}

<style>
	.ex-sections {
		display: contents;
	}
	.schema {
		display: grid;
		gap: var(--hx-space-10);
	}
	.schema td code {
		white-space: nowrap;
	}
	.schema + .schema {
		padding-top: var(--hx-space-16);
		border-top: var(--hx-border-thin) solid var(--ex-line);
	}
	.schema h3 {
		color: var(--ex-text);
		font-weight: var(--hx-style-weight-semibold);
	}
</style>
