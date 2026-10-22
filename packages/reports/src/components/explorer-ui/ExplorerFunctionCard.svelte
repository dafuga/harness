<script lang="ts">
	import { type CatalogRow } from '../../utils/explorer-ui/entityCatalog';
	import { entityLens, type EntityLens, type EntityNav } from '../../utils/explorer-ui/entityLens';
	import ExplorerUsage from '../ExplorerUsage.svelte';
	import EntityLink from './harness/EntityLink.svelte';
	let {
		row,
		nav,
		lens,
		mediaBase,
		showUsage = true
	}: {
		row: CatalogRow;
		nav: EntityNav;
		lens: EntityLens;
		mediaBase: string;
		showUsage?: boolean;
	} = $props();
	let to = $derived(
		entityLens(nav.route, {
			category: row.entity.category,
			entity: row.entity.id,
			helper: row.helper?.name,
			tab: 'contract'
		})
	);
	/** A call from this revision's documented values; unspecified arguments stay named variables. */
	function invocation(unit: CatalogRow['entity']['unit']): string {
		const helper = row.helper;
		const name = helper?.name ?? '';
		const inputs = helper?.inputs ?? [];
		const owner = name;
		const documented = unit.documentation?.examples[0]?.input;
		const values =
			unit.contract.inputs[0]?.name.startsWith(`${name}.`) &&
			documented &&
			typeof documented === 'object' &&
			!Array.isArray(documented)
				? (documented as Record<string, unknown>)
				: {};
		const args = inputs
			.filter((input) => !owner || input.name.startsWith(`${owner}.`))
			.map((input) => {
				const parameter = input.name.split('.').at(-1)!;
				if (Object.hasOwn(values, parameter)) return JSON.stringify(values[parameter]);
				const declared = unit.contract.inputs.find((field) => field.name === input.name);
				if (declared?.examples?.length) return JSON.stringify(declared.examples[0]);
				return parameter;
			});
		if (!name) return unit.title;
		return `${name}(${args.join(', ')})`;
	}
	let call = $derived(row.helper ? invocation(row.entity.unit) : row.name);
</script>

<article class="ex-function-tile" aria-label={row.name}>
	<EntityLink
		{to}
		{nav}
		class="ex-function-call"
		title={row.helper
			? 'Example usage; arguments without recorded sample values remain named variables.'
			: undefined}
	>
		<code>{call}</code>
	</EntityLink>
	{#if showUsage}
		<ExplorerUsage
			consumers={row.usedIn ?? []}
			{nav}
			{lens}
			{mediaBase}
			layout={row.entity.category === 'models' ? 'flat' : 'grouped'}
		/>
	{/if}
</article>

<style>
	.ex-function-tile {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		align-content: start;
		align-items: center;
		min-width: 0;
		border: 1px solid var(--ex-line);
		border-radius: var(--ex-radius);
		background: var(--ex-surface);
	}
	.ex-function-tile code {
		display: block;
		max-height: 6em;
		overflow: auto;
		white-space: pre-wrap;
		overflow-wrap: anywhere;
		font:
			0.9rem/1.6 ui-monospace,
			SFMono-Regular,
			Menlo,
			monospace;
	}
	.ex-function-tile :global(.ex-function-call) {
		display: block;
		min-width: 0;
		padding: 16px 16px 8px;
		border-radius: inherit;
	}
	.ex-function-tile > :global(.ex-usage) {
		padding: 0 16px 14px;
	}
</style>
