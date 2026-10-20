<script lang="ts">
	import { type CatalogRow } from '../utils/entityCatalog';
	import { entityLens, type EntityNav } from '../utils/entityLens';
	import EntityLink from './harness/EntityLink.svelte';
	let { row, nav }: { row: CatalogRow; nav: EntityNav } = $props();
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
	<div class="ex-function-usage" role="group" aria-label="Used In">
		<span>Used In</span>
		{#each row.usedIn ?? [] as consumer (consumer.id)}
			<EntityLink
				to={entityLens(nav.route, { category: consumer.category, entity: consumer.id })}
				{nav}
				class="ex-function-consumer">{consumer.name}</EntityLink
			>
		{:else}<span>—</span>{/each}
	</div>
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
	.ex-function-usage {
		display: flex;
		flex-wrap: wrap;
		gap: 4px 10px;
		padding: 0 16px 14px;
		color: var(--ex-muted);
		font-size: 0.75rem;
		line-height: 1.5;
	}
	.ex-function-usage :global(.ex-function-consumer) {
		color: var(--ex-soft);
		overflow-wrap: anywhere;
		text-decoration: underline;
		text-underline-offset: 3px;
	}
	.ex-function-usage :global(.ex-function-consumer:hover) {
		color: var(--ex-text);
	}
</style>
