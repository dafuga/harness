<!-- @harness-tier organism -->
<!-- @harness-atoms ../../shared-primitives/atoms -->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { ExplorerEntity } from '../../../models/explorer-ui/Explorer.types';
	import type { ExplorerScreenProps } from '../../../models/explorer-ui/ExplorerScreen.types';
	import type { EntityNav } from '../../../utils/explorer-ui/entityLens';
	import { entityMetricComparison } from '../../../utils/explorer-ui/entityMetricComparison';
	import { entityShown, modelTableView } from './entityShown';
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
	const said = { 'used-in': 'used in', uses: 'uses', models: 'models', apis: 'apis' } as const;
	// A page opens its models, at its former Contract address too, and its APIs on their own tabs.
	let related = $derived.by(() => {
		const tab = host.route.tab === 'contract' ? 'models' : host.route.tab;
		if (entity.category === 'pages' && (tab === 'models' || tab === 'apis')) return tab;
		if (tab === 'used-in' && entity.category !== 'pages') return tab;
		return tab === 'uses' && usesAvailable ? tab : null;
	});
	let removed = $derived(entity.change === 'removed');
	let visual = $derived(['pages', 'components', 'layouts'].includes(entity.category));
	// Functions and services show their authored uses; their former Tests address opens them too.
	let examples = $derived(
		['functions', 'services'].includes(entity.category) &&
			(host.route.tab === 'examples' || host.route.tab === 'tests')
	);
	// The purpose is the sentence under the name of an overview tab; it is not said twice there.
	let contract = $derived(summary.contract.filter((row) => row.label !== 'Purpose'));
	let tableView = $derived(modelTableView(entity.unit));
	let tables = $derived(tableView.tables);
	let gaps = $derived(tableView.gaps);
	let schemaTitle = $derived(entity.lastAt ? `Last table · ${entity.lastAt.slice(0, 7)}` : 'Table');
</script>

<hx-div class="ex-sections" data-harness-component="harness-entity-sections">
	<!-- The tab of the address decides what an entity screen shows; any other shows its overview. -->
	{#if related}
		<hx-div role="tabpanel" aria-label={`${entity.name} ${said[related]}`}>
			<EntityRelations {host} {relations} {nav} show={related} {removed} />
		</hx-div>
	{:else if examples}
		<hx-div role="tabpanel" aria-label={`${entity.name} examples`} class="ex-stack">
			{#if entity.category === 'services'}
				<!-- Creation leads; recorded verification stays apart from authored uses. -->
				<EntityExamples documentation={entity.unit.documentation} setupTitle="Create the service" />
				<hx-p class="ex-soft">These examples are authored documentation, not test results.</hx-p>
				<hx-details
					><hx-summary>Verification details</hx-summary>{@render verificationPanel()}</hx-details
				>
			{:else}
				<EntityExamples documentation={entity.unit.documentation} />
			{/if}
		</hx-div>
	{:else if entity.category === 'components' && host.route.tab === 'audio'}
		<hx-div role="tabpanel" aria-label={`${entity.name} audio`}>
			<EntityAudio
				evidence={host.lens.evidence(entity.unit)}
				scope={host.scope}
				mediaBase={host.mediaBase}
				empty
			/>
		</hx-div>
	{:else if host.route.tab === 'states' || host.route.tab === 'tests'}
		{#if visual}
			<hx-div role="tabpanel" aria-label={`${entity.name} states`}>
				<EntityStates
					name={entity.name}
					evidence={host.lens.evidence(entity.unit)}
					scope={host.scope}
					mediaBase={host.mediaBase}
				/>
				<hx-details
					><hx-summary>Verification details</hx-summary>{@render verificationPanel()}</hx-details
				>
			</hx-div>
		{:else}{@render verificationPanel()}{/if}
	{:else if host.route.tab === 'source'}
		<hx-div role="tabpanel" aria-label={`${entity.name} source`}>
			<EntitySource
				unit={entity.unit}
				{entity}
				{nav}
				repository={host.index.sourceRepository}
				commit={entity.lastAt ?? host.scope.commit}
			/>
		</hx-div>
	{:else if host.route.tab === 'contract'}
		<hx-div role="tabpanel" aria-label={`${entity.name} contract`}>
			<EntityContract
				unit={entity.unit}
				category={entity.category}
				{contract}
				last={entity.lastAt}
			/>
		</hx-div>
	{:else if entity.category === 'models' && host.route.tab === 'table'}
		<hx-div role="tabpanel" aria-label={`${entity.name} table`}>
			<hx-section class="ex-card" aria-label={entity.lastAt ? 'Last table' : 'Table'}>
				<hx-h2><HarnessIcon name="database" size={24} /> {schemaTitle}</hx-h2>
				{#if entity.lastAt}
					<hx-p class="ex-note">Removed at the shown commit; this is what its parent held.</hx-p>
				{/if}
				{#if tables.length > 0}
					<hx-p class="ex-note">Read from the committed source; no database is queried.</hx-p>
				{/if}
				{#each tables as item, position (position)}
					<hx-div class="schema">
						<hx-h3><hx-code>{item.table.name}</hx-code></hx-h3>
						<hx-p class="ex-note">
							Declared by <hx-code>{item.name}</hx-code> in <hx-code>{item.source}</hx-code>.
						</hx-p>
						<hx-div class="ex-scroll">
							<hx-table class="ex-table" aria-label={`${item.table.name} columns`}>
								<hx-thead>
									<hx-tr>
										<hx-th scope="col">Column</hx-th>
										<hx-th scope="col">Property</hx-th>
										<hx-th scope="col">Type</hx-th>
										<hx-th scope="col">Primary key</hx-th>
										<hx-th scope="col">Nullable</hx-th>
										<hx-th scope="col">Default</hx-th>
									</hx-tr>
								</hx-thead>
								<hx-tbody>
									{#each item.table.columns as column, columnPosition (columnPosition)}
										<hx-tr>
											<hx-td><hx-code>{column.name}</hx-code></hx-td>
											<hx-td><hx-code>{column.property}</hx-code></hx-td>
											<hx-td><hx-code>{column.type}</hx-code></hx-td>
											<hx-td>{column.primaryKey ? 'Yes' : 'No'}</hx-td>
											<hx-td>{column.nullable ? 'Yes' : 'No'}</hx-td>
											<hx-td>{column.default ?? 'None'}</hx-td>
										</hx-tr>
									{/each}
								</hx-tbody>
							</hx-table>
						</hx-div>
					</hx-div>
				{/each}
				{#each gaps as item, position (position)}
					<hx-p class="ex-note"
						>The table of <hx-code>{item.name}</hx-code> is unresolved: {item.gap}</hx-p
					>
				{/each}
				{#if tables.length === 0 && gaps.length === 0}
					<hx-p class="ex-note">This revision records no database table for this model.</hx-p>
				{/if}
			</hx-section>
		</hx-div>
	{:else}
		<EntityOverview {entity} measure={summary.measure} {comparison}>
			{@render pane()}
		</EntityOverview>
	{/if}
</hx-div>

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
