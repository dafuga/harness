<!-- @harness-tier organism -->
<!-- @harness-atoms ../../../../reports/src/components/shared-primitives/atoms -->
<!-- @harness-uid u_lall66omcz -->
<script lang="ts">
	import type { EntityContract } from '../../models/development-tooling/Desktop.types';
	import { humanize } from '$reports/utils/explorer-ui/entityContract';
	import DetailList from '$shared/shared-primitives/DetailList.svelte';
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
		<DetailList rows={contract[group]} rowKey={(field) => field.name}>
			{#snippet label(field: EntityContract['inputs'][number])}{humanize(
					field.name.split('.').at(-1)!
				)}{/snippet}
			{#snippet children(field: EntityContract['inputs'][number])}
				{#if group === 'inputs'}
					<hx-div data-contract-input="" class="input-metadata">
						<hx-span class="requirement"
							>{field.required === true
								? 'Required'
								: field.required === false
									? 'Optional'
									: 'Requiredness not recorded'}</hx-span
						>
						<hx-span class="default"
							>{#if Object.hasOwn(field, 'default')}Default: <hx-code
									>{JSON.stringify(field.default) ?? String(field.default)}</hx-code
								>{:else}No default{/if}</hx-span
						>
					</hx-div>
				{/if}
				<hx-div
					><hx-code>{field.type}</hx-code> · {field.description ??
						'No description recorded.'}</hx-div
				>
			{/snippet}
			{#snippet empty()}<hx-p>Nothing declared.</hx-p>{/snippet}
		</DetailList>
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
	.panel :global(dl) {
		display: block;
		margin: 0 0 var(--hx-space-18);
	}
	.panel :global(.detail-row) {
		display: grid;
		gap: var(--hx-space-5);
		padding: var(--hx-space-10) 0;
		border-bottom: var(--hx-border-thin) solid var(--hx-color-border);
	}
	.panel :global(dt) {
		text-transform: capitalize;
		font-weight: var(--hx-style-weight-semibold);
	}
	.panel :global(dd) {
		margin: 0;
		color: var(--hx-color-text-muted);
		line-height: var(--hx-style-leading-normal);
	}
	summary {
		cursor: pointer;
		color: var(--hx-color-text-muted);
		padding: var(--hx-space-8) 0;
	}
	.input-metadata {
		display: grid;
		gap: var(--hx-space-5);
		margin-bottom: var(--hx-space-5);
	}
	.panel :global(dd) {
		overflow-wrap: anywhere;
	}
	.contract-field {
		flex-wrap: wrap;
		overflow-wrap: anywhere;
	}
</style>
