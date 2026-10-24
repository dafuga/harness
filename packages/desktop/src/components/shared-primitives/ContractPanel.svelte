<script lang="ts">
	import type { EntityContract } from '../../models/development-tooling/Desktop.types';
	import { humanize } from '../../../../reports/src/utils/entityContract';
	let { contract }: { contract: EntityContract } = $props();
	const groups = [
		['inputs', 'Accepts'],
		['outputs', 'Returns'],
		['errors', 'Can fail with']
	] as const;
</script>

<section class="panel">
	<h2>Contract</h2>
	{#each groups as [group, title] (group)}
		<h3>{title}</h3>
		<dl>
			{#each contract[group] as field (field.name)}
				<div>
					<dt>{humanize(field.name.split('.').at(-1)!)}</dt>
					<dd>{field.description ?? 'No description recorded.'}</dd>
				</div>
			{:else}<div><dd>Nothing declared.</dd></div>{/each}
		</dl>
	{/each}
	<details>
		<summary>Technical contract</summary>
		{#each groups as [group, title] (group)}<h3>{title}</h3>
			{#each contract[group] as field (field.name)}
				<div class="contract-field"><strong>{field.name}</strong><code>{field.type}</code></div>
			{/each}
		{/each}
	</details>
</section>

<style>
	dl {
		display: block;
		margin: 0 0 var(--hx-space-18);
	}
	dl > div {
		display: grid;
		gap: var(--hx-space-5);
		padding: var(--hx-space-10) 0;
		border-bottom: var(--hx-border-thin) solid var(--hx-color-border);
	}
	dt {
		text-transform: capitalize;
		font-weight: var(--hx-style-weight-semibold);
	}
	dd {
		margin: 0;
		color: var(--hx-color-text-muted);
		line-height: var(--hx-style-leading-normal);
	}
	summary {
		cursor: pointer;
		color: var(--hx-color-text-muted);
		padding: var(--hx-space-8) 0;
	}
	.contract-field {
		flex-wrap: wrap;
		overflow-wrap: anywhere;
	}
</style>
