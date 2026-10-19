<script lang="ts">
	import type { CatalogRow } from '../utils/entityCatalog';
	import { entityLens, type EntityNav } from '../utils/entityLens';
	import EntityLink from './harness/EntityLink.svelte';
	import HarnessIcon from './harness/HarnessIcon.svelte';
	let { row, nav }: { row: CatalogRow; nav: EntityNav } = $props();
	const open = 'Open function';
	let to = $derived(entityLens(nav.route, { category: 'functions', entity: row.id }));
	/** A call from this revision's documented values; unspecified arguments stay named variables. */
	function invocation(unit: CatalogRow['entity']['unit']): string {
		const inputs = unit.contract.inputs;
		const owner = inputs[0]?.name.split('.').slice(0, -1).join('.');
		const name =
			owner || unit.owns.symbols.find((symbol) => /^[a-z_$]/.test(symbol)) || unit.owns.symbols[0];
		const documented = unit.documentation?.examples[0]?.input;
		const values =
			documented && typeof documented === 'object' && !Array.isArray(documented)
				? (documented as Record<string, unknown>)
				: {};
		const args = inputs
			.filter((input) => !owner || input.name.startsWith(`${owner}.`))
			.map((input) => {
				const parameter = input.name.split('.').at(-1)!;
				if (Object.hasOwn(values, parameter)) return JSON.stringify(values[parameter]);
				if (input.examples?.length) return JSON.stringify(input.examples[0]);
				return parameter;
			});
		if (!name) return unit.title;
		return `${name}(${args.join(', ')})`;
	}
	let call = $derived(invocation(row.entity.unit));
</script>

<article class="ex-function-tile" aria-label={row.name}>
	<EntityLink
		{to}
		{nav}
		title="Example usage; arguments without recorded sample values remain named variables."
	>
		<code>{call}</code>
	</EntityLink>
	<EntityLink {to} {nav} class="hx-action gold ex-function-open" label={open} title={open}>
		<HarnessIcon name="arrow-right" size={18} />
	</EntityLink>
</article>

<style>
	.ex-function-tile {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 36px;
		align-content: start;
		align-items: center;
		gap: 10px 16px;
		min-width: 0;
		padding: 16px;
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
	.ex-function-tile :global(.ex-function-open) {
		grid-column: 2;
		grid-row: 1;
		width: 36px;
		height: 36px;
		min-height: 36px;
		padding: 8px;
	}
</style>
