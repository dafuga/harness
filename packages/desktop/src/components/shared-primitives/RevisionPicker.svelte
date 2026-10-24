<!-- @harness-tier organism -->
<!-- @harness-atoms ../../../../reports/src/components/shared-primitives/atoms -->
<script lang="ts">
	import Select from '$shared/Select.svelte';
	import type { Workspace } from '../../lib/stores/projects-sessions/workspace.svelte';
	import { displayTime, revisionTime } from '../../utils/revisionTime';
	import ChoiceDialog from './ChoiceDialog.svelte';
	import Icon from './Icon.svelte';
	/** One selected context and its source-specific update time, with revision choices behind icons. */
	let { workspace }: { workspace: Workspace } = $props();
	let branch = $state('');
	let commit = $state('');
	const snapshot = $derived(workspace.snapshot);
	const revision = $derived(snapshot?.revision);
	$effect(() => {
		branch = revision?.branch || '';
		commit = revision?.commit || '';
	});
	/** A commit that is viewed on purpose is named as such, also when it is the tip. */
	const viewed = $derived.by(() => {
		if (!revision) return '';
		if (!revision.atTip) return `Historical commit · ${revision.commit.slice(0, 7)}`;
		return workspace.pinned ? 'Pinned commit · branch tip' : 'Current · branch tip';
	});
	const committed = $derived(snapshot ? revisionTime(snapshot, 'commit') : null);
	const tipped = $derived(snapshot ? revisionTime(snapshot, 'branch') : null);
	const environment = $derived(
		workspace.deployments.viewing ? workspace.deployments.environment : null
	);
	const name = $derived(
		environment ? 'Updated at' : workspace.pinned ? revision?.commit.slice(0, 7) : revision?.branch
	);
	const updated = $derived(
		environment
			? (workspace.deployments.selected?.receipt?.updatedAt ?? null)
			: workspace.pinned
				? committed
				: tipped
	);
	/** A choice closes its dialog, so focus is back on its icon while the revision loads. */
	function chooseBranch(close?: () => void) {
		workspace.deployments.viewing = false;
		close?.();
		void workspace.navigate(workspace.link({ branch }));
	}
	function chooseCommit(close: () => void) {
		workspace.deployments.viewing = false;
		close();
		void workspace.navigate(workspace.link({ branch, commit }));
	}
</script>

{#snippet when(label: string, value: string | null)}<hx-small
		>{label}
		{#if value}<hx-time datetime={value}>{displayTime(value)}</hx-time>{:else}Unknown{/if}</hx-small
	>{/snippet}

{#if snapshot && revision}<hx-div class="revision-picker">
		<hx-div class="revision-choices">
			<ChoiceDialog
				label="Choose branch"
				title="Choose branch"
				width={320}
				maxHeight={320}
				gap={10}
			>
				{#snippet icon()}<Icon name="branch" size={18} />{/snippet}
				{#snippet children(close: () => void)}<hx-label
						class="picker-field"
						onchange={() => chooseBranch(close)}
						>Branch<Select
							label="Branch"
							title={`Tip · ${revision.tip.slice(0, 7)}`}
							bind:value={branch}
							>{#each snapshot.branches as item (item.name)}<hx-option value={item.name}
									>{item.name}</hx-option
								>{/each}</Select
						></hx-label
					>{@render when(`Branch tip ${revision.tip.slice(0, 7)} committed`, tipped)}{/snippet}
				{#snippet footer(close: () => void)}<hx-button
						type="button"
						onclick={() => chooseBranch(close)}>View branch</hx-button
					>{/snippet}
			</ChoiceDialog>
			<ChoiceDialog
				label="Choose commit"
				title="Choose commit"
				width={380}
				maxHeight={320}
				gap={10}
			>
				{#snippet icon()}<Icon name="commit" size={18} />{/snippet}
				{#snippet children(close: () => void)}<hx-label
						class="picker-field"
						onchange={() => chooseCommit(close)}
						>Commit<Select label="Commit" title={viewed} bind:value={commit}
							>{#each snapshot.commits as item (item.hash)}<hx-option value={item.hash}
									>{item.hash.slice(0, 7)} · {item.subject}</hx-option
								>{/each}</Select
						></hx-label
					>{@render when('Commit updated', committed)}{/snippet}
				{#snippet footer(close: () => void)}<hx-button
						type="button"
						onclick={() => chooseCommit(close)}>View commit</hx-button
					>{/snippet}
			</ChoiceDialog>
		</hx-div>
		<hx-div class="revision-summary" aria-label="Viewed context">
			<hx-strong title={name}>{name}</hx-strong><hx-small
				>{environment ? '' : '· '}<hx-time datetime={updated ?? undefined} title="Last updated"
					>{displayTime(updated)}</hx-time
				></hx-small
			>
		</hx-div>
		{#if !environment && (!revision.atTip || workspace.pinned)}<hx-button
				type="button"
				class="go-to-tip"
				aria-label="Go to tip"
				title="Go to tip"
				onclick={() => chooseBranch()}>Go to tip</hx-button
			>{/if}
	</hx-div>{/if}

<style>
	/* The icons and the line of what is shown share one row; a pinned commit adds Go to tip. */
	.revision-picker {
		align-items: center;
		gap: var(--hx-space-8);
	}
	/* The branch and commit icons are a group of their own only where a phone draws one. */
	.revision-choices {
		display: contents;
	}
	.revision-summary {
		display: flex;
		align-items: baseline;
		gap: var(--hx-space-6);
		flex: 0 1 auto;
		min-width: 0;
		max-width: 300px;
		margin-inline-start: var(--hx-space-4);
		font-size: var(--hx-type-size-compact);
		line-height: var(--hx-style-leading-snug);
	}
	.revision-summary > * {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.revision-summary strong {
		min-width: 0;
	}
	.revision-summary small {
		flex: none;
		line-height: var(--hx-style-leading-snug);
	}
	/* In its dialog a picker is a field of the dialog's width, not one of the bar. */
	.picker-field {
		display: grid;
		gap: var(--hx-space-6);
		width: auto;
		max-width: none;
	}
	.picker-field :global(.report-select) {
		display: block;
	}
	/* Context and timestamp share the inset line beneath the mobile control rail. */
	@media (max-width: 560px) {
		.revision-picker {
			display: contents;
		}
		.revision-choices {
			grid-area: revision;
			display: flex;
			justify-self: start;
			margin: var(--hx-space-8) 0 0 calc(-1 * var(--hx-space-1));
			border-radius: 0 var(--hx-radius-small) var(--hx-radius-small) 0;
			background: var(--hx-color-surface);
			box-shadow: inset 0 0 0 var(--hx-border-thin) var(--hx-color-border);
		}
		.revision-summary {
			grid-area: summary;
			display: flex;
			align-items: baseline;
			gap: var(--hx-space-8);
			min-width: 0;
			max-width: none;
			margin: var(--hx-space-2) 0 var(--hx-space-8);
			padding-inline: var(--hx-space-6);
			line-height: var(--hx-space-13);
		}
		/* A long branch gives way first; what is shown stays whole. */
		.revision-summary strong {
			flex: 0 1 auto;
			min-width: 0;
			font-size: var(--hx-type-size-xs);
		}
		.revision-summary small {
			flex: none;
			font-size: var(--hx-type-size-2xs);
			line-height: var(--hx-space-13);
		}
		.go-to-tip {
			grid-area: tip;
			justify-self: end;
			height: 30px;
			margin: var(--hx-space-8) var(--hx-space-6) 0 0;
			padding: 0 var(--hx-space-12);
			border-color: var(--hx-color-primary-line);
			border-radius: var(--hx-radius-xlarge);
			background: none;
			color: var(--hx-color-primary);
		}
	}
</style>
