<script lang="ts">
	import type { DeploymentActivity } from '../../models/development-tooling/Deployment.types';
	let {
		deployment
	}: { deployment: Pick<DeploymentActivity, 'sourceEnvironment' | 'environment' | 'branch'> } =
		$props();
	/** Where it comes from: the environment promoted, or else the Git branch, which reads as code. */
	const source = $derived(deployment.sourceEnvironment ?? deployment.branch);
</script>

<span class="deployment-route" role="group" aria-label="From {source} to {deployment.environment}"
	><span class="place" class:branch={!deployment.sourceEnvironment}>{source}</span>
	<span class="arrow" aria-hidden="true">→</span>
	<span class="place to">{deployment.environment}</span></span
>

<style>
	/* A long branch wraps inside its tag, and the destination follows it onto the next line. */
	.deployment-route {
		display: inline-flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 4px 6px;
		max-width: 100%;
		vertical-align: middle;
	}
	.place {
		min-width: 0;
		padding: 0 7px;
		border: 1px solid var(--line);
		border-radius: 5px;
		background: rgb(255 255 255 / 0.03);
		color: #cfe0ec;
		line-height: 1.6;
		overflow-wrap: anywhere;
	}
	.branch {
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		font-size: 0.95em;
	}
	.to {
		border-color: #4b7891;
		color: #edf4fa;
		font-weight: 600;
	}
	.arrow {
		color: var(--gold);
		font-weight: 600;
	}
</style>
