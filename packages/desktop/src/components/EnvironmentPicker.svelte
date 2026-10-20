<script lang="ts">
	import Select from '$shared/Select.svelte';
	import { untrack, type Snippet } from 'svelte';
	import type { Workspace } from '../lib/stores/workspace.svelte';
	import { deploymentEnvironments } from '../models/Deployment.types';
	import { displayTime } from '../utils/revisionTime';
	/**
	 * The environment a Change is scoped to, always in sight with its last verified deployment.
	 * Choosing one changes the scope only: nothing is deployed. A Change reaches preprod at most;
	 * prod is reached through Deploy alone, which promotes preprod. `children` is the action beside
	 * the choice.
	 */
	let { workspace, children }: { workspace: Workspace; children?: Snippet } = $props();
	const deployments = $derived(workspace.deployments);
	/** Follows the chosen environment; a choice is held only until the store has it. */
	let value = $derived<string>(deployments.environment);
	const status = $derived(deployments.selected);
	const receipt = $derived(status?.receipt ?? null);
	/** Only prod is beyond what a Change reaches. */
	const gated = $derived(deployments.environment === 'prod');
	const reason = $derived(
		deployments.error || status?.reason || 'No deployment status for this project.'
	);
	/** Read once per shown project: an answer, or another commit, is no reason to read again. */
	const projectId = $derived(workspace.projectId);
	$effect(() => {
		void projectId;
		untrack(() => void deployments.load());
	});
	function choose() {
		const next = deploymentEnvironments.find((item) => item === value);
		if (next) deployments.choose(next);
		value = deployments.environment;
	}
</script>

<div class="environment-picker">
	<div class="environment-choice">
		<label onchange={choose}
			><Select label="Environment" bind:value
				>{#each deploymentEnvironments as item (item)}<option value={item}>{item}</option
					>{/each}</Select
			></label
		>{@render children?.()}
	</div>
	{#if receipt}<small title="Last verified deployment to {receipt.environment}: {receipt.commit}"
			>Deployed {receipt.commit.slice(0, 7)} ·
			<time datetime={receipt.updatedAt}>{displayTime(receipt.updatedAt)}</time></small
		>{:else if deployments.loading}<small>Checking deployments…</small
		>{:else if status?.available}<small>No verified deployment</small>{:else}<small title={reason}
			>Unavailable</small
		>{/if}
	{#if gated}<small class="environment-note" role="status"
			>Changes reach preprod. Use Deploy to promote preprod to production.</small
		>{/if}
</div>

<style>
	/* A fixed width, so a status or the note that comes and goes never moves the bar. */
	.environment-picker {
		display: grid;
		flex: none;
		align-content: center;
		gap: 3px;
		width: 210px;
	}
	.environment-choice {
		display: flex;
		align-items: center;
		gap: 6px;
	}
	.environment-choice label {
		flex: 1;
		min-width: 0;
	}
	.environment-choice :global(.report-select) {
		display: block;
	}
	.environment-choice :global(select) {
		height: 34px;
		min-height: 34px !important;
		padding-block: 0;
		font-size: 13px;
	}
	small {
		font-size: 11px;
		line-height: 1.35;
	}
	.environment-note {
		color: var(--gold);
	}
	/* On a phone the status follows the choice on its row; the note takes the row under them. */
	@media (max-width: 560px) {
		.environment-picker {
			grid-template-columns: auto minmax(0, 1fr);
			align-items: center;
			column-gap: 10px;
			width: 100%;
		}
		.environment-note {
			grid-column: 1 / -1;
		}
	}
</style>
