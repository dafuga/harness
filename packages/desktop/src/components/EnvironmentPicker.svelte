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

<div class="environment-picker" class:gated>
	<div class="environment-choice">
		<label onchange={choose}
			><Select label="Environment" bind:value
				>{#each deploymentEnvironments as item (item)}<option value={item}>{item}</option
					>{/each}</Select
			></label
		>{@render children?.()}
	</div>
	<div class="environment-status">
		{#if receipt}<small
				class="deployed"
				title="Last verified deployment to {receipt.environment}: {receipt.commit}"
				>Deployed <code>{receipt.commit.slice(0, 7)}</code>
				<time datetime={receipt.updatedAt}>{displayTime(receipt.updatedAt)}</time></small
			>{:else if deployments.loading}<small>Checking deployments…</small
			>{:else if status?.available}<small>No verified deployment</small>{:else}<small title={reason}
				>Unavailable</small
			>{/if}
		{#if gated}<small class="environment-note" role="status">
				<span class="full-note"
					>Changes reach preprod. Use Deploy to promote preprod to production.</span
				>
				<span class="compact-note">Changes reach preprod. Deploy promotes to prod.</span></small
			>{/if}
	</div>
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
	.environment-status {
		display: grid;
		gap: 3px;
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
	/* A verified deployment: a teal mark and its short commit, then when, on a line of its own. */
	.deployed::before {
		content: '';
		display: inline-block;
		width: 6px;
		height: 6px;
		margin-inline-end: 6px;
		border-radius: 50%;
		background: #7fe3c0;
		vertical-align: 1px;
	}
	.deployed code {
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		color: #cfe0ec;
	}
	.deployed time {
		display: block;
		padding-inline-start: 12px;
	}
	.environment-note {
		color: var(--gold);
	}
	.compact-note {
		display: none;
	}
	/* Prod is reached through Deploy alone; while prod is chosen, Deploy is marked as the way there. */
	.gated .environment-choice :global(.agent-icon:enabled) {
		border-color: rgb(255 208 53 / 0.55);
		color: var(--gold);
	}
	/* On a phone the choice and Deploy begin the bar's rail, which the revision icons end. How the
	   environment stands is told under the rail on a line of its own, its time after its commit; a
	   note wraps under that line. Both keep off the edge of the bar's frame round them. */
	@media (max-width: 560px) {
		.full-note {
			display: none;
		}
		.compact-note {
			display: inline;
		}
		.environment-picker {
			display: contents;
		}
		.environment-choice {
			grid-area: environment;
			gap: 0;
			margin: 8px 0 0 6px;
			border-radius: 8px 0 0 8px;
			background: var(--panel);
			box-shadow: inset 0 0 0 1px var(--line);
		}
		/* The rail draws the choice; a hairline parts it from Deploy. */
		.environment-picker .environment-choice :global(.report-select select) {
			padding-inline: 12px 28px;
			border-color: transparent;
			border-inline-end-color: var(--line);
			border-radius: 8px 0 0 8px;
			background-color: transparent;
			font-weight: 600;
		}
		.environment-picker .environment-choice :global(.report-select svg) {
			inset-inline-end: 8px;
		}
		.environment-choice :global(select:focus-visible) {
			outline: 2px solid var(--gold);
			outline-offset: -2px;
		}
		.environment-status {
			grid-area: status;
			gap: 0;
			min-width: 0;
			margin-bottom: 8px;
			padding-inline: 6px;
		}
		small {
			line-height: 13px;
		}
		.deployed code {
			line-height: 1;
		}
		small:not(.environment-note) {
			overflow: hidden;
			white-space: nowrap;
			text-overflow: ellipsis;
		}
		.deployed time {
			display: inline;
			padding-inline-start: 0;
		}
		.deployed time::before {
			content: '· ' / '';
		}
	}
</style>
