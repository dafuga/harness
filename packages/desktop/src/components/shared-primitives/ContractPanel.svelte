<!-- @harness-tier molecule -->
<!-- @harness-atoms ../../../../reports/src/components/shared-primitives/atoms -->
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

<hx-section class="panel">
	<hx-h2>Contract</hx-h2>
	{#each groups as [group, title] (group)}
		<hx-h3>{title}</hx-h3>
		<hx-dl>
			{#each contract[group] as field (field.name)}
				<hx-div>
					<hx-dt>{humanize(field.name.split('.').at(-1)!)}</hx-dt>
					<hx-dd>{field.description ?? 'No description recorded.'}</hx-dd>
				</hx-div>
			{:else}<hx-div><hx-dd>Nothing declared.</hx-dd></hx-div>{/each}
		</hx-dl>
	{/each}
	<hx-details>
		<hx-summary>Technical contract</hx-summary>
		{#each groups as [group, title] (group)}<hx-h3>{title}</hx-h3>
			{#each contract[group] as field (field.name)}
				<hx-div class="contract-field"
					><hx-strong>{field.name}</hx-strong><hx-code>{field.type}</hx-code></hx-div
				>
			{/each}
		{/each}
	</hx-details>
</hx-section>

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
