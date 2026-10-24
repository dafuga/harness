<!-- @harness-tier organism -->
<!-- @harness-atoms ../shared-primitives/atoms -->
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
<hx-div
	class="ex-scroll"
	class:ex-config-values={category === 'configs'}
	data-harness-component="harness-explorer-table"
>
	<hx-table class="ex-table" aria-label={heading}>
		<hx-thead>
			<hx-tr>
				{#if category === 'configs'}
					<hx-th scope="col">Variable</hx-th><hx-th scope="col">Value</hx-th>
				{:else}
					<hx-th scope="col">{one}</hx-th>
					{#each shown as [title], position (position)}<hx-th scope="col">{title}</hx-th>{/each}
					{#if verification}<hx-th scope="col">Verification</hx-th>{/if}
					<hx-th scope="col"><hx-span class="ex-hidden">Open</hx-span></hx-th>
				{/if}
			</hx-tr>
		</hx-thead>
		<hx-tbody>
			{#each rows as row (row.id)}
				<hx-tr>
					{#if category === 'configs'}
						{@const name = row.name.startsWith(`${heading}.`)
							? row.name.slice(heading.length + 1)
							: row.name}
						{@const key = name.lastIndexOf('.') + 1}
						<hx-th scope="row"
							><EntityLink to={open(row)} {nav}
								><hx-code class="ex-config-name"
									><hx-span class="ex-config-scope"
										>{#each words(name.slice(0, key)) as word, position (position)}{word}<hx-wbr
											/>{/each}</hx-span
									>{#each words(name.slice(key)) as word, position (position)}{word}<hx-wbr
										/>{/each}</hx-code
								></EntityLink
							></hx-th
						>
						<hx-td>
							<ConfigValue
								name={row.name}
								source={value(row)}
								literal={row.setting?.literal}
								structure={row.setting?.structure}
								onview={(event) => view(row, event)}
							/>
						</hx-td>
					{:else}
						<hx-th scope="row">
							<hx-span class="ex-row-name">
								<hx-span class="ex-tile small"
									><HarnessIcon name={categoryIcon[category]} /></hx-span
								>
								<hx-span>
									<EntityLink to={open(row)} {nav}>{row.name}</EntityLink>
									{#if described}<hx-span class="ex-soft ex-block">{row.summary}</hx-span>{/if}
								</hx-span>
							</hx-span>
						</hx-th>
						{#each shown as [title, read], position (position)}
							<hx-td data-label={title} class:changed={title === 'Changed' && row.changed}
								>{#if read}{read(row)}{:else}<ExplorerUsage
										consumers={row.usedIn ?? []}
										{nav}
										{lens}
										{mediaBase}
									/>{/if}</hx-td
							>
						{/each}
						{#if verification}<hx-td data-label="Verification"
								><HarnessVerdict {...row.verdict} /></hx-td
							>{/if}
						<hx-td class="ex-open">
							<HarnessAction
								href={nav.href(open(row))}
								onclick={() => nav.go(open(row))}
								tone="plain"
								icon="arrow-right"
								label={`Open ${row.name}`}>Open</HarnessAction
							>
						</hx-td>
					{/if}
				</hx-tr>
			{/each}
		</hx-tbody>
	</hx-table>
	<Modal open={chosen !== null} title={`${chosen?.name} · Value`} variant="text" onClose={close}>
		{#if contents}
			<ConfigValueTree node={contents} />
			<hx-details class="ex-full">
				<hx-summary>Source expression</hx-summary>
				<hx-pre class="ex-value-full"><hx-code>{chosen?.setting?.value}</hx-code></hx-pre>
			</hx-details>
		{:else if chosen}
			<hx-pre class="ex-value-full"><hx-code>{value(chosen)}</hx-code></hx-pre>
		{/if}
	</Modal>
</hx-div>
<style>
	@import "./explorer-table/explorerTable.css";
</style>
