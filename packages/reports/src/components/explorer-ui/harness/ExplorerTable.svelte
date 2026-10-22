<script lang="ts">
	import type { ExplorerCategory } from '../../../models/explorer-ui/Explorer.types';
	import { listed, type CatalogRow } from '../../../utils/explorer-ui/entityCatalog';
	import { humanize } from '../../../utils/explorer-ui/entityContract';
	import {
		entityLabels,
		entityLens,
		type EntityLens,
		type EntityNav
	} from '../../../utils/explorer-ui/entityLens';
	import { categoryIcon } from '../../../utils/explorer-ui/harnessIcons';
	import ExplorerUsage from '../../ExplorerUsage.svelte';
	import EntityLink from './EntityLink.svelte';
	import HarnessAction from './HarnessAction.svelte';
	import HarnessIcon from './HarnessIcon.svelte';
	import HarnessVerdict from './harness-verdict/HarnessVerdict.svelte';
	/** Pages and components are only ever the shared visual card, never a table row. */
	type Kind = Exclude<ExplorerCategory, 'pages' | 'components'>;
	let {
		category,
		rows,
		nav,
		lens,
		mediaBase,
		verification = true
	}: {
		category: Kind;
		rows: CatalogRow[];
		nav: EntityNav;
		lens: EntityLens;
		mediaBase: string;
		verification?: boolean;
	} = $props();
	/** A column's words for a row; null for what uses the row, shown as the shared usage footer. */
	type Column = [string, ((row: CatalogRow) => string) | null];
	const targets = (row: CatalogRow) => row.targets.map(humanize).join(' · ') || 'none';
	const columns: Record<Kind, Column[]> = {
		shells: [
			['Used on', null],
			['Contains', (row) => listed(row.contains, 2)]
		],
		functions: [
			['Responsibility', (row) => row.summary],
			['Used by', null]
		],
		models: [
			['Purpose', (row) => row.summary],
			['Used by', null]
		],
		configs: [],
		services: [
			['Responsibility', (row) => row.summary],
			['Execution target', targets],
			['Consumers', null]
		]
	};
	let shown = $derived(columns[category]);
	let one = $derived(entityLabels[category].one);
	// A shell is described under its name; the other kinds have a column for it.
	let described = $derived(category === 'shells');
	const open = (row: CatalogRow) => entityLens(nav.route, { category, entity: row.entity.id });
</script>

<div
	class="ex-scroll"
	class:ex-config-values={category === 'configs'}
	data-harness-component="harness-explorer-table"
>
	<table class="ex-table" aria-label={entityLabels[category].title}>
		<thead>
			<tr>
				{#if category === 'configs'}
					<th scope="col">Variable</th><th scope="col">Value</th>
				{:else}
					<th scope="col">{one}</th>
					{#each shown as [title], position (position)}<th scope="col">{title}</th>{/each}
					{#if verification}<th scope="col">Verification</th>{/if}
					<th scope="col"><span class="ex-hidden">Open</span></th>
				{/if}
			</tr>
		</thead>
		<tbody>
			{#each rows as row (row.id)}
				<tr>
					{#if category === 'configs'}
						<th scope="row"
							><EntityLink to={open(row)} {nav}><code>{row.name}</code></EntityLink></th
						>
						<td><code>{row.setting?.value ?? 'Not recorded at this revision'}</code></td>
					{:else}
						<th scope="row">
							<span class="ex-row-name">
								<span class="ex-tile small"><HarnessIcon name={categoryIcon[category]} /></span>
								<span>
									<EntityLink to={open(row)} {nav}>{row.name}</EntityLink>
									{#if described}<span class="ex-soft ex-block">{row.summary}</span>{/if}
								</span>
							</span>
						</th>
						{#each shown as [title, read], position (position)}
							<td data-label={title} class:changed={title === 'Changed' && row.changed}
								>{#if read}{read(row)}{:else}<ExplorerUsage
										consumers={row.usedIn ?? []}
										{nav}
										{lens}
										{mediaBase}
									/>{/if}</td
							>
						{/each}
						{#if verification}<td data-label="Verification"><HarnessVerdict {...row.verdict} /></td
							>{/if}
						<td class="ex-open">
							<HarnessAction
								href={nav.href(open(row))}
								onclick={() => nav.go(open(row))}
								tone="plain"
								icon="arrow-right"
								label={`Open ${row.name}`}>Open</HarnessAction
							>
						</td>
					{/if}
				</tr>
			{/each}
		</tbody>
	</table>
</div>

<style>
	.ex-config-values :global(.ex-table) {
		min-width: 0;
		table-layout: auto;
	}
	.ex-config-values :global(:is(th, td)) {
		vertical-align: top;
	}
	.ex-config-values :global(code) {
		white-space: pre-wrap;
		overflow-wrap: normal;
		word-break: normal;
	}
</style>
