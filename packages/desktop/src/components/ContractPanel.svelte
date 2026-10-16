<script lang="ts">
	import type { EntityContract } from '../models/Desktop.types';
	import { humanize } from '../../../reports/src/utils/entityContract';
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
		margin: 0 0 18px;
	}
	dl > div {
		display: grid;
		gap: 5px;
		padding: 10px 0;
		border-bottom: 1px solid var(--line);
	}
	dt {
		text-transform: capitalize;
		font-weight: 600;
	}
	dd {
		margin: 0;
		color: var(--muted);
		line-height: 1.5;
	}
	summary {
		cursor: pointer;
		color: var(--muted);
		padding: 8px 0;
	}
	.contract-field {
		flex-wrap: wrap;
		overflow-wrap: anywhere;
	}
</style>
