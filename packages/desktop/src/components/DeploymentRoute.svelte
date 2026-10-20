<script lang="ts">
	import type { DeploymentActivity } from '../models/Deployment.types';
	let {
		deployment
	}: { deployment: Pick<DeploymentActivity, 'sourceEnvironment' | 'environment' | 'branch'> } =
		$props();
	const source = $derived(deployment.sourceEnvironment ?? deployment.branch);
</script>

<span aria-label="From {source} to {deployment.environment}"
	>{source} <span aria-hidden="true">→</span> {deployment.environment}</span
>

<style>
	span {
		overflow-wrap: anywhere;
	}
</style>
