<script lang="ts">
	// The shared dialog's own sheet, so the desktop host draws it as the reports do.
	import '../../lib/styles/gallery.css';
	import { tick } from 'svelte';
	import { listed, type CatalogRow } from '../../utils/explorer-ui/entityCatalog';
	import { humanize } from '../../utils/explorer-ui/entityContract';
	import {
		entityLabels,
		entityLens,
		type EntityLens,
		type EntityNav
	} from '../../utils/explorer-ui/entityLens';
	import { categoryIcon } from '../../utils/explorer-ui/harnessIcons';
	import ExplorerUsage from '../ExplorerUsage.svelte';
	import Modal from '../shared-primitives/Modal.svelte';
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
	// The variables of one source file are one table, named as the file is; a mix keeps the kind's.
	let heading = $derived.by(() => {
		const file = rows[0]?.configFile;
		return category === 'configs' &&
			file &&
			rows.every((row) => row.configFile?.source === file.source)
			? file.title
			: entityLabels[category].title;
	});
	const open = (row: CatalogRow) => entityLens(nav.route, { category, entity: row.entity.id });
	/** A config value as written, which its cell types and its dialog shows whole. */
	const value = (row: CatalogRow) => row.setting?.value ?? 'Not recorded at this revision';
	/** A name stays one text, breaking after a dot or between camel-case words, never inside one. */
	const words = (name: string) => name.match(/.+?(?:\.|[a-z\d](?=[A-Z])|$)/g) ?? [];
	let chosen = $state.raw<CatalogRow | null>(null);
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
	// Another revision or search brings other rows: a value they no longer hold is not left open.
	$effect.pre(() => {
		const held = chosen && value(chosen);
		if (!rows.some((row) => row.name === chosen?.name && value(row) === held)) chosen = null;
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
										>{#each words(row.name.slice(0, key)) as word, index (index)}{word}<wbr
											/>{/each}</span
									>{#each words(row.name.slice(key)) as word, index (index)}{word}<wbr
										/>{/each}</code
								></EntityLink
							></th
						>
						<td>
							<ConfigValue
								name={row.name}
								source={value(row)}
								literal={row.setting?.literal}
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
		{#if chosen}<pre class="ex-value-full"><code>{value(chosen)}</code></pre>{/if}
	</Modal>
</div>

<style>
	/* Two columns at every width: the name of a variable, then its value. */
	.ex-config-values .ex-table {
		table-layout: fixed;
	}
	.ex-config-values.ex-scroll :global(:is(th, td)) {
		padding-block: 12px;
		vertical-align: top;
	}
	.ex-config-values :global(thead th:first-child) {
		width: 36%;
	}
	.ex-config-name {
		font-size: var(--hx-type-size-sm);
		line-height: 1.5;
		overflow-wrap: anywhere;
	}
	.ex-config-scope {
		color: var(--ex-muted);
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
		.ex-config-values.ex-scroll :global(:is(th, td)) {
			padding: 10px;
		}
		.ex-config-values :global(thead th:first-child) {
			width: 40%;
		}
	}
</style>
