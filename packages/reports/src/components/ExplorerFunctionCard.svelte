<script lang="ts">
	import { functionName, type CatalogRow } from '../utils/entityCatalog';
	import { entityLens, type EntityNav } from '../utils/entityLens';
	import EntityLink from './harness/EntityLink.svelte';
	let { row, nav }: { row: CatalogRow; nav: EntityNav } = $props();
	let to = $derived(entityLens(nav.route, { category: 'functions', entity: row.id }));
	/** A call from this revision's documented values; unspecified arguments stay named variables. */
	function invocation(unit: CatalogRow['entity']['unit']): string {
		const inputs = unit.contract.inputs;
		const owner = inputs[0]?.name.split('.').slice(0, -1).join('.');
		const name = functionName(unit);
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
		class="ex-function-call"
		title="Example usage; arguments without recorded sample values remain named variables."
	>
		<code>{call}</code>
	</EntityLink>
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
		padding: 16px;
		border-radius: inherit;
	}
</style>
