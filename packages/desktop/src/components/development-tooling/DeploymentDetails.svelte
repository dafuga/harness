<!-- @harness-tier organism -->
<!-- @harness-atoms ../../../../reports/src/components/shared-primitives/atoms -->
<script lang="ts">
	import DetailList from '$shared/shared-primitives/DetailList.svelte';
	import { deploymentFacts, receiptFacts } from './deploymentFacts';
	import type { DeploymentFact } from './deploymentFacts.types';
	import type { DeploymentActivity } from '../../models/development-tooling/Deployment.types';
	import { displayTime } from '../../utils/development-tooling/revisionTime';
	import DeploymentProgress from './DeploymentProgress.svelte';
	import DeploymentRoute from './DeploymentRoute.svelte';
	/**
	 * One deployment: where it goes and the commit it deploys, then its progress, with why it failed,
	 * and the receipt it ended with. Where the deployment is named already, its identity is left out;
	 * the route, the progress and the receipt are the same wherever a deployment is shown.
	 */
	let {
		deployment,
		showIdentity = true
	}: { deployment: DeploymentActivity; showIdentity?: boolean } = $props();
	/** A receipt is written only once the deployment and its health are verified. */
	const receipt = $derived(deployment.phase === 'complete' ? deployment.receipt : null);
</script>

{#snippet fact(row: DeploymentFact)}
	{#if row.format === 'time'}<hx-time datetime={row.value}>{displayTime(row.value)}</hx-time>
	{:else if row.format === 'code'}<hx-code>{row.value}</hx-code>
	{:else}{row.value}{/if}
{/snippet}

{#snippet factName(row: DeploymentFact)}{row.name}{/snippet}
{#snippet factValue(row: DeploymentFact)}{@render fact(row)}{/snippet}

<hx-div class="deployment-details">
	<hx-div class="head">
		{#if showIdentity}<hx-h2>{deployment.environment} deployment</hx-h2>{/if}
		<DeploymentRoute {deployment} />
	</hx-div>
	{#if showIdentity}<DetailList
			rows={deploymentFacts(deployment)}
			rowKey={(row) => row.name}
			className="facts"
			grouped={false}
			label={factName}
			children={factValue}
		/>{/if}
	<DeploymentProgress {deployment} />
	{#if receipt}<hx-div class="receipt">
			<hx-h3>Verified receipt</hx-h3>
			<DetailList
				rows={receiptFacts(receipt)}
				rowKey={(row) => row.name}
				className="receipt-facts"
				grouped={false}
				label={factName}
				children={factValue}
			/>
		</hx-div>{/if}
</hx-div>

<style>
	.deployment-details {
		display: grid;
		gap: var(--hx-space-14);
		padding-block-start: var(--hx-space-12);
	}
	/* Named by its destination with its route under it, as in the list it was chosen from. */
	.head {
		display: grid;
		justify-items: start;
		gap: var(--hx-space-6);
		font-size: var(--hx-type-size-xs);
	}
	h2 {
		margin: 0;
		font-size: var(--hx-type-size-base);
		color: var(--hx-color-primary);
	}
	.receipt {
		display: grid;
		gap: var(--hx-space-8);
	}
	h3 {
		margin: 0;
		font-size: var(--hx-type-size-2xs);
		font-weight: var(--hx-style-weight-semibold);
		letter-spacing: var(--hx-style-tracking-wide);
		text-transform: uppercase;
		color: var(--hx-color-text-muted);
	}
	/* Each name beside its value; a full commit wraps rather than being cut on a phone. */
	.deployment-details :global(dl) {
		display: grid;
		grid-template-columns: max-content minmax(0, 1fr);
		align-items: baseline;
		gap: var(--hx-space-6) var(--hx-space-16);
		margin: 0;
		font-size: var(--hx-type-size-compact);
	}
	.deployment-details :global(.facts) {
		padding-block: var(--hx-space-10);
		border-block: var(--hx-border-thin) solid var(--hx-color-border);
	}
	/* A phone stacks each name over its value, so a full commit has the width to stay on one line. */
	@media (max-width: 560px) {
		.deployment-details :global(dl) {
			grid-template-columns: minmax(0, 1fr);
		}
	}
	.deployment-details :global(dt) {
		font-size: var(--hx-type-size-xs);
		color: var(--hx-color-text-muted);
	}
	.deployment-details :global(dd) {
		margin: 0;
		color: var(--hx-color-text);
		overflow-wrap: anywhere;
	}
	code {
		font-family: var(--hx-font-family-code);
		font-size: var(--hx-type-size-compact);
	}
</style>
