<!-- @harness-tier molecule -->
<!-- @harness-atoms ../../../../reports/src/components/shared-primitives/atoms -->
<script lang="ts">
	import type { DeploymentActivity } from '../../models/development-tooling/Deployment.types';
	let {
		deployment
	}: { deployment: Pick<DeploymentActivity, 'sourceEnvironment' | 'environment' | 'branch'> } =
		$props();
	/** Where it comes from: the environment promoted, or else the Git branch, which reads as code. */
	const source = $derived(deployment.sourceEnvironment ?? deployment.branch);
</script>

<hx-span
	class="deployment-route"
	role="group"
	aria-label="From {source} to {deployment.environment}"
	><hx-span class="place" class:branch={!deployment.sourceEnvironment}>{source}</hx-span>
	<hx-span class="arrow" aria-hidden="true">→</hx-span>
	<hx-span class="place to">{deployment.environment}</hx-span></hx-span
>

<style>
	/* A long branch wraps inside its tag, and the destination follows it onto the next line. */
	.deployment-route {
		display: inline-flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--hx-space-4) var(--hx-space-6);
		max-width: 100%;
		vertical-align: middle;
	}
	.place {
		min-width: 0;
		padding: 0 var(--hx-space-7);
		border: var(--hx-border-thin) solid var(--hx-color-border);
		border-radius: var(--hx-radius-xsmall);
		background: var(--hx-color-hover);
		color: var(--hx-color-text-supporting);
		line-height: var(--hx-style-leading-normal);
		overflow-wrap: anywhere;
	}
	.branch {
		font-family: var(--hx-font-family-code);
		font-size: var(--hx-type-size-inline);
	}
	.to {
		border-color: var(--hx-color-info-line);
		color: var(--hx-color-text);
		font-weight: var(--hx-style-weight-semibold);
	}
	.arrow {
		color: var(--hx-color-primary);
		font-weight: var(--hx-style-weight-semibold);
	}
</style>
