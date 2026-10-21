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

{#snippet when(name: string, value: string | null)}{#if value}<div>
			<dt>{name}</dt>
			<dd><time datetime={value}>{displayTime(value)}</time></dd>
		</div>{/if}{/snippet}

<div class="deployment-details">
	<div class="head">
		{#if showIdentity}<h2>{deployment.environment} deployment</h2>{/if}
		<DeploymentRoute {deployment} />
	</div>
	{#if showIdentity}<dl class="facts">
			<div>
				<dt>Project</dt>
				<dd>{deployment.projectName}</dd>
			</div>
			<div>
				<dt>Branch</dt>
				<dd><code>{deployment.branch}</code></dd>
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
		gap: 14px;
	}
	/* Named by its destination with its route under it, as in the list it was chosen from. */
	.head {
		display: grid;
		justify-items: start;
		gap: 6px;
		font-size: 12px;
	}
	h2 {
		margin: 0;
		font-size: 16px;
		color: var(--gold);
	}
	.receipt {
		display: grid;
		gap: 8px;
	}
	h3 {
		margin: 0;
		font-size: 11px;
		font-weight: 600;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--muted);
	}
	/* Each name beside its value; a full commit wraps rather than being cut on a phone. */
	dl {
		display: grid;
		grid-template-columns: max-content minmax(0, 1fr);
		align-items: baseline;
		gap: 6px 16px;
		margin: 0;
		font-size: 13px;
	}
	.facts {
		padding-block: 10px;
		border-block: 1px solid var(--line);
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
		color: #edf4fa;
		overflow-wrap: anywhere;
	}
	code {
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		font-size: 12.5px;
	}
</style>
