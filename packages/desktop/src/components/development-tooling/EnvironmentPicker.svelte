<script lang="ts">
	import Select from '$shared/Select.svelte';
	import { untrack, type Snippet } from 'svelte';
	import type { Workspace } from '../../lib/stores/workspace.svelte';
	import { deploymentEnvironments } from '../../models/development-tooling/Deployment.types';
	/** Selects change scope without deploying; the shared summary names the selected context. */
	let { workspace, children }: { workspace: Workspace; children?: Snippet } = $props();
	const deployments = $derived(workspace.deployments);
	/** Follows the chosen environment; a choice is held only until the store has it. */
	let value = $derived<string>(deployments.environment);
	/** Only prod is beyond what a Change reaches. */
	const gated = $derived(deployments.environment === 'prod');
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

<div class="environment-picker" class:gated>
	<div class="environment-choice">
		<label onchange={choose}
			><Select label="Environment" bind:value
				>{#each deploymentEnvironments as item (item)}<option value={item}>{item}</option
					>{/each}</Select
			></label
		>{@render children?.()}
	</div>
</div>

<style>
	/* The existing selector and promotion action share the control rail. */
	.environment-picker {
		display: grid;
		flex: none;
		align-content: center;
		gap: var(--hx-space-3);
		width: 142px;
	}
	.environment-choice {
		display: flex;
		align-items: center;
		gap: var(--hx-space-6);
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
		font-size: var(--hx-type-size-compact);
	}
	/* Prod is reached through Deploy alone; while prod is chosen, Deploy is marked as the way there. */
	.gated .environment-choice :global(.agent-icon:enabled) {
		border-color: var(--hx-color-primary-line);
		color: var(--hx-color-primary);
	}
	/* On a phone the environment and Deploy begin the shared control rail. */
	@media (max-width: 560px) {
		.environment-picker {
			display: contents;
		}
		.environment-choice {
			grid-area: environment;
			gap: 0;
			margin: var(--hx-space-8) 0 0 var(--hx-space-6);
			border-radius: var(--hx-radius-small) 0 0 var(--hx-radius-small);
			background: var(--hx-color-surface);
			box-shadow: inset 0 0 0 var(--hx-border-thin) var(--hx-color-border);
		}
		/* The rail draws the choice; a hairline parts it from Deploy. */
		.environment-picker .environment-choice :global(.report-select select) {
			padding-inline: var(--hx-space-12) var(--hx-space-28);
			border-color: transparent;
			border-inline-end-color: var(--hx-color-border);
			border-radius: var(--hx-radius-small) 0 0 var(--hx-radius-small);
			background-color: transparent;
			font-weight: var(--hx-style-weight-semibold);
		}
		.environment-picker .environment-choice :global(.report-select svg) {
			inset-inline-end: 8px;
		}
		.environment-choice :global(select:focus-visible) {
			outline: var(--hx-border-thick) solid var(--hx-color-primary);
			outline-offset: calc(-1 * var(--hx-space-2));
		}
	}
</style>
