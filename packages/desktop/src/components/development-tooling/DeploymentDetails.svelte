<!-- @harness-tier organism -->
<!-- @harness-atoms ../../../../reports/src/components/shared-primitives/atoms -->
<script lang="ts">
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

{#snippet when(name: string, value: string | null)}{#if value}<hx-div>
			<hx-dt>{name}</hx-dt>
			<hx-dd><hx-time datetime={value}>{displayTime(value)}</hx-time></hx-dd>
		</hx-div>{/if}{/snippet}

<hx-div class="deployment-details">
	<hx-div class="head">
		{#if showIdentity}<hx-h2>{deployment.environment} deployment</hx-h2>{/if}
		<DeploymentRoute {deployment} />
	</hx-div>
	{#if showIdentity}<hx-dl class="facts">
			<hx-div>
				<hx-dt>Project</hx-dt>
				<hx-dd>{deployment.projectName}</hx-dd>
			</hx-div>
			<hx-div>
				<hx-dt>Branch</hx-dt>
				<hx-dd><hx-code>{deployment.branch}</hx-code></hx-dd>
			</hx-div>
			<hx-div>
				<hx-dt>Commit</hx-dt>
				<hx-dd><hx-code>{deployment.commit}</hx-code></hx-dd>
			</hx-div>
			{@render when(
				deployment.startedAt ? 'Started' : 'Queued',
				deployment.startedAt ?? deployment.createdAt
			)}
			{@render when('Finished', deployment.finishedAt)}
		</hx-dl>{/if}
	<DeploymentProgress {deployment} />
	{#if receipt}<hx-div class="receipt">
			<hx-h3>Verified receipt</hx-h3>
			<hx-dl>
				<hx-div>
					<hx-dt>Deployment</hx-dt>
					<hx-dd><hx-code>{receipt.deploymentId}</hx-code></hx-dd>
				</hx-div>
				<hx-div>
					<hx-dt>Address</hx-dt>
					<hx-dd>{receipt.url}</hx-dd>
				</hx-div>
				{@render when('Verified', receipt.updatedAt)}
			</hx-dl>
		</hx-div>{/if}
</hx-div>

<style>
	.deployment-details {
		display: grid;
		gap: var(--hx-space-14);
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
	dl {
		display: grid;
		grid-template-columns: max-content minmax(0, 1fr);
		align-items: baseline;
		gap: var(--hx-space-6) var(--hx-space-16);
		margin: 0;
		font-size: var(--hx-type-size-compact);
	}
	.facts {
		padding-block: var(--hx-space-10);
		border-block: var(--hx-border-thin) solid var(--hx-color-border);
	}
	dl div {
		display: contents;
	}
	dt {
		font-size: var(--hx-type-size-xs);
		color: var(--hx-color-text-muted);
	}
	dd {
		margin: 0;
		color: var(--hx-color-text);
		overflow-wrap: anywhere;
	}
	code {
		font-family: var(--hx-font-family-code);
		font-size: var(--hx-type-size-compact);
	}
</style>
