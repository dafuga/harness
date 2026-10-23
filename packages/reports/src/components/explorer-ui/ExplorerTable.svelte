<script lang="ts">
	import '../../lib/styles/gallery.css';
	import { tick } from 'svelte';
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
	import ConfigValueTree, { collection } from './ConfigValueTree.svelte';
	import EntityLink from './EntityLink.svelte';
	import HarnessAction from './HarnessAction.svelte';
	import HarnessIcon from './HarnessIcon.svelte';
	import type { Kind, Column } from './ExplorerTable.types';
	import ConfigValue from './explorer-table/ConfigValue.svelte';
	import HarnessVerdict from './harness-verdict/HarnessVerdict.svelte';
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
		types: [['Used by', null]],
		configs: [],
		services: [
			['Responsibility', (row) => row.summary],
			['Execution target', targets],
			['Consumers', null]
		]
	};
	let shown = $derived(columns[category]);
	let one = $derived(entityLabels[category].one);
	let described = $derived(category === 'layouts');
	let heading = $derived(
		category === 'configs' && new Set(rows.map((row) => row.configFile?.source)).size === 1
			? (rows[0]?.configFile?.title ?? entityLabels[category].title)
			: entityLabels[category].title
	);
	const open = (row: CatalogRow) => entityLens(nav.route, { category, entity: row.entity.id });
	const value = (row: CatalogRow) => row.setting?.value ?? 'Not recorded at this revision';
	/** A name stays one text, breaking after a dot or between camel-case words, never inside one. */
	const words = (name: string) => name.match(/.+?(?:\.|[a-z\d](?=[A-Z])|$)/g) ?? [];
	let chosen = $state.raw<CatalogRow | null>(null);
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
	$effect.pre(() => {
		if (chosen && !rows.includes(chosen)) chosen = null;
	});
</script>

<div
	class="ex-scroll"
	class:ex-config-values={category === 'configs'}
	data-harness-component="harness-explorer-table"
>
	<table class="ex-table" aria-label={heading}>
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
						{@const key = row.name.lastIndexOf('.') + 1}
						<th scope="row"
							><EntityLink to={open(row)} {nav}
								><code class="ex-config-name"
									><span class="ex-config-scope"
										>{#each words(row.name.slice(0, key)) as word, position (position)}{word}<wbr
											/>{/each}</span
									>{#each words(row.name.slice(key)) as word, position (position)}{word}<wbr
										/>{/each}</code
								></EntityLink
							></th
						>
						<td>
							<ConfigValue
								name={row.name}
								source={value(row)}
								literal={row.setting?.literal}
								structure={row.setting?.structure}
								onview={(event) => view(row, event)}
							/>
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
		padding-block: var(--hx-space-12);
		vertical-align: top;
	}
	.ex-config-values :global(thead th:first-child) {
		width: 36%;
	}
	.ex-config-name {
		font-size: var(--hx-type-size-sm);
		line-height: var(--hx-style-leading-normal);
		overflow-wrap: anywhere;
	}
	.ex-config-scope {
		color: var(--ex-muted);
	}
	.ex-config-values :global(.viewer-dialog .ex-value-full) {
		max-height: min(70dvh, 720px);
		margin: 0;
		padding: var(--hx-space-14) var(--hx-space-16);
		border-radius: var(--hx-radius-small);
		background: var(--ex-raised);
		font-size: var(--hx-type-size-base);
		white-space: pre;
	}
	.ex-config-values :global(.viewer-header h2) {
		overflow-wrap: anywhere;
	}
	@media (max-width: 640px) {
		.ex-config-values.ex-scroll :global(:is(th, td)) {
			padding: var(--hx-space-10);
		}
		.ex-config-values :global(thead th:first-child) {
			width: 40%;
		}
	}
</style>
