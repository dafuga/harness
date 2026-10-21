<script lang="ts">
	import type { ExplorerCategory } from '../../models/Explorer.types';
	import { listed, type CatalogRow } from '../../utils/entityCatalog';
	import { humanize } from '../../utils/entityContract';
	import { entityLabels, entityLens, type EntityNav } from '../../utils/entityLens';
	import { categoryIcon } from '../../utils/harnessIcons';
	import EntityLink from './EntityLink.svelte';
	import HarnessAction from './HarnessAction.svelte';
	import HarnessIcon from './HarnessIcon.svelte';
	import HarnessVerdict from './harness-verdict/HarnessVerdict.svelte';
	type Kind = Exclude<ExplorerCategory, 'pages'>;
	let { category, rows, nav }: { category: Kind; rows: CatalogRow[]; nav: EntityNav } = $props();
	/** What uses a row: the entities that use it directly, else the pages it is shown on. */
	const users = (row: CatalogRow) => listed(row.usedBy.length ? row.usedBy : row.usedOn);
	const targets = (row: CatalogRow) => row.targets.map(humanize).join(' · ') || 'none';
	const composed: Array<[string, (row: CatalogRow) => string]> = [
		['Used on', (row) => listed(row.usedOn)],
		['Contains', (row) => listed(row.contains, 2)]
	];
	const columns: Record<Kind, Array<[string, (row: CatalogRow) => string]>> = {
		shells: composed,
		components: composed,
		functions: [
			['Responsibility', (row) => row.summary],
			['Used by', users]
		],
		models: [
			['Purpose', (row) => row.summary],
			['Used by', users]
		],
		configs: [
			['Purpose', (row) => row.summary],
			['Used by', users],
			['Changed', (row) => (row.changed ? 'Changed' : '—')]
		],
		services: [
			['Responsibility', (row) => row.summary],
			['Execution target', targets],
			['Consumers', users]
		]
	};
	let shown = $derived(columns[category]);
	let one = $derived(entityLabels[category].one);
	// A shell or a component is described under its name; the other kinds have a column for it.
	let described = $derived(category === 'shells' || category === 'components');
	const open = (row: CatalogRow) => entityLens(nav.route, { category, entity: row.id });
</script>

<div class="ex-scroll">
	<table class="ex-table" aria-label={entityLabels[category].title}>
		<thead>
			<tr>
				<th scope="col">{one}</th>
				{#each shown as [title], position (position)}<th scope="col">{title}</th>{/each}
				<th scope="col">Verification</th>
				<th scope="col"><span class="ex-hidden">Open</span></th>
			</tr>
		</thead>
		<tbody>
			{#each rows as row (row.id)}
				<tr>
					<th scope="row">
						<span class="ex-row-name">
							<span class="ex-tile small"><HarnessIcon name={categoryIcon[category]} /></span>
							<span>
								<EntityLink to={open(row)} {nav}>{row.name}</EntityLink>
								{#if row.shared}<span class="ex-pill gold">Shared</span>{/if}
								{#if described}<span class="ex-soft ex-block">{row.summary}</span>{/if}
							</span>
						</span>
					</th>
					{#each shown as [title, read], position (position)}
						<td data-label={title} class:changed={title === 'Changed' && row.changed}
							>{read(row)}</td
						>
					{/each}
					<td data-label="Verification"><HarnessVerdict {...row.verdict} /></td>
					<td class="ex-open">
						<span class="ex-row-actions">
							<HarnessAction
								href={nav.href(open(row))}
								onclick={() => nav.go(open(row))}
								tone="plain"
								icon="arrow-right"
								label={`Open ${row.name}`}>Open</HarnessAction
							>
						</span>
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>

<style>
	.ex-row-actions {
		display: inline-flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: flex-end;
		gap: 8px;
	}
</style>
