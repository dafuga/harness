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
	type Kind = Exclude<ExplorerCategory, 'pages'>;
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
	const composed: Column[] = [
		['Used on', null],
		['Contains', (row) => listed(row.contains, 2)]
	];
	const columns: Record<Kind, Column[]> = {
		platforms: [],
		shells: composed,
		components: composed,
		functions: [
			['Responsibility', (row) => row.summary],
			['Used by', null]
		],
		models: [
			['Purpose', (row) => row.summary],
			['Used by', null]
		],
		configs: [
			['Purpose', (row) => row.summary],
			['Used by', null],
			['Changed', (row) => (row.changed ? 'Changed' : '—')]
		],
		services: [
			['Responsibility', (row) => row.summary],
			['Execution target', targets],
			['Consumers', null]
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
				{#if verification}<th scope="col">Verification</th>{/if}
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
				</tr>
			{/each}
		</tbody>
	</table>
</div>
