<script lang="ts">
	// The shared dialog's own sheet, so the desktop host draws it as the reports do.
	import '../../lib/styles/gallery.css';
	import { tick } from 'svelte';
	import type { ExplorerCategory } from '../../models/explorer-ui/Explorer.types';
	import { listed, type CatalogRow } from '../../utils/explorer-ui/entityCatalog';
	import { humanize } from '../../helpers/strings/humanize';
	import {
		entityLabels,
		entityLens,
		type EntityLens,
		type EntityNav
	} from '../../utils/explorer-ui/entityLens';
	import { categoryIcon } from '../../utils/explorer-ui/harnessIcons';
	import ExplorerUsage from '../ExplorerUsage.svelte';
	import Modal from '../shared-primitives/Modal.svelte';
	import ConfigValueTree, { collection, valueMark } from './ConfigValueTree.svelte';
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
		platforms: [],
		layouts: [
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
	let described = $derived(category === 'layouts');
	const open = (row: CatalogRow) => entityLens(nav.route, { category, entity: row.entity.id });
	const value = (row: CatalogRow) => row.setting?.value ?? 'Not recorded at this revision';
	let chosen = $state.raw<CatalogRow | null>(null);
	/** An object or array opens as its contents; any other value opens as written. */
	let contents = $derived(collection(chosen?.setting?.structure));
	let opener: HTMLElement | null = null;
	function view(row: CatalogRow, event: MouseEvent) {
		opener = event.currentTarget instanceof HTMLElement ? event.currentTarget : null;
		chosen = row;
	}
	async function close() {
		chosen = null;
		await tick();
		opener?.focus();
	}
	// A replacement row closes the modal, even when aliases kept the outer source text identical.
	$effect.pre(() => {
		if (chosen && !rows.includes(chosen)) chosen = null;
	});
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
						{@const mark = valueMark(row.setting?.structure, value(row))}
						<th scope="row"
							><EntityLink to={open(row)} {nav}><code>{row.name}</code></EntityLink></th
						>
						<td>
							{#if mark}
								<div class="ex-value">
									<HarnessAction
										tone="plain"
										label={`View value for ${row.name}`}
										onclick={(event) => view(row, event)}
										><HarnessIcon name={mark.icon} size={18} /></HarnessAction
									>
									<span class="ex-note">{mark.size}</span>
								</div>
							{:else}
								<code>{value(row)}</code>
							{/if}
						</td>
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
	<Modal open={chosen !== null} title={`${chosen?.name} · Value`} variant="text" onClose={close}>
		{#if contents}
			<ConfigValueTree node={contents} />
			<details class="ex-full">
				<summary>Source expression</summary>
				<pre class="ex-value-full"><code>{chosen?.setting?.value}</code></pre>
			</details>
		{:else if chosen}
			<pre class="ex-value-full"><code>{value(chosen)}</code></pre>
		{/if}
	</Modal>
</div>

<style>
	.ex-config-values .ex-table {
		table-layout: fixed;
	}
	.ex-config-values.ex-scroll :global(:is(th, td)) {
		vertical-align: top;
	}
	.ex-config-values :global(thead th:first-child) {
		width: 17rem;
	}
	.ex-config-values :global(:is(th code, td > code)) {
		white-space: pre-wrap;
		overflow-wrap: anywhere;
	}
	.ex-value {
		display: flex;
		align-items: center;
		gap: 10px;
	}
	.ex-value :global(.hx-action) {
		width: 44px;
		padding: 0;
	}
	.ex-config-values :global(.viewer-dialog .ex-value-full) {
		max-height: min(70dvh, 720px);
		margin: 0;
		padding: 14px 16px;
		border-radius: 8px;
		background: var(--ex-raised);
		font-size: 0.95rem;
		white-space: pre;
	}
	.ex-config-values :global(.viewer-header h2) {
		overflow-wrap: anywhere;
	}
	@media (max-width: 640px) {
		.ex-config-values :global(thead th:first-child) {
			width: 32%;
		}
	}
</style>
