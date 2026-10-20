<script lang="ts">
	import type { DeploymentActivity } from '../models/Deployment.types';
	import { displayTime } from '../utils/revisionTime';
	import DeploymentProgress from './DeploymentProgress.svelte';
	/**
	 * One deployment: where it goes and the commit it deploys, then its progress, why it failed or
	 * the receipt it ended with. Where the deployment is named already, its identity is left out;
	 * the progress, the failure and the receipt are the same wherever a deployment is shown.
	 */
	let {
		deployment,
		showIdentity = true
	}: { deployment: DeploymentActivity; showIdentity?: boolean } = $props();
	/** A receipt is written only once the deployment and its health are verified. */
	const receipt = $derived(deployment.phase === 'complete' ? deployment.receipt : null);
</script>

{#snippet when(name: string, value: string | null)}{#if value}<div>
			<dt>{name}</dt>
			<dd><time datetime={value}>{displayTime(value)}</time></dd>
		</div>{/if}{/snippet}

<div class="deployment-details">
	{#if showIdentity}<h2>{deployment.environment} deployment</h2>
		<dl>
			<div>
				<dt>Project</dt>
				<dd>{deployment.projectName}</dd>
			</div>
			<div>
				<dt>Branch</dt>
				<dd>{deployment.branch}</dd>
			</div>
			<div>
				<dt>Commit</dt>
				<dd><code>{deployment.commit}</code></dd>
			</div>
			{@render when(
				deployment.startedAt ? 'Started' : 'Queued',
				deployment.startedAt ?? deployment.createdAt
			)}
			{@render when('Finished', deployment.finishedAt)}
		</dl>{/if}
	<DeploymentProgress {deployment} />
	{#if deployment.error}<p class="error" role="alert">{deployment.error}</p>{/if}
	{#if receipt}<div class="receipt">
			<h3>Verified receipt</h3>
			<dl>
				<div>
					<dt>Deployment</dt>
					<dd><code>{receipt.deploymentId}</code></dd>
				</div>
				<div>
					<dt>Address</dt>
					<dd>{receipt.url}</dd>
				</div>
				{@render when('Verified', receipt.updatedAt)}
			</dl>
		</div>{/if}
</div>

<style>
	.deployment-details {
		display: grid;
		gap: 12px;
	}
	.receipt {
		display: grid;
		gap: 6px;
	}
	h2 {
		margin: 0;
		font-size: 15px;
		color: var(--gold);
	}
	h3 {
		margin: 0;
		font-size: 12px;
		color: var(--muted);
	}
	/* Each name beside its value; a full commit wraps rather than being cut on a phone. */
	dl {
		display: grid;
		grid-template-columns: max-content minmax(0, 1fr);
		align-items: baseline;
		gap: 4px 12px;
		margin: 0;
		font-size: 13px;
	}
	dl div {
		display: contents;
	}
	dt {
		font-size: 12px;
		color: var(--muted);
	}
	dd {
		margin: 0;
		overflow-wrap: anywhere;
	}
	code {
		font-size: 12px;
	}
	.error {
		margin: 0;
		padding: 8px 12px;
		border-radius: 6px;
		font-size: 12px;
	}
</style>
