<script lang="ts">
	import Select from '$shared/Select.svelte';
	import type { Workspace } from '../lib/stores/workspace.svelte';
	import { displayTime, revisionTime } from '../utils/revisionTime';
	import ChoiceDialog from './ChoiceDialog.svelte';
	import Icon from './Icon.svelte';
	/**
	 * The shown revision is said in one place; its branch and commit pickers wait behind icons.
	 * Git times are told as such: when the commit and the branch tip were committed, never when
	 * anything was deployed.
	 */
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
	/** A choice closes its dialog, so focus is back on its icon while the revision loads. */
	function chooseBranch(close?: () => void) {
		close?.();
		void workspace.navigate(workspace.link({ branch }));
	}
	function chooseCommit(close: () => void) {
		close();
		void workspace.navigate(workspace.link({ branch, commit }));
	}
</script>

{#snippet when(label: string, value: string | null)}<small
		>{label}
		{#if value}<time datetime={value}>{displayTime(value)}</time>{:else}Unknown{/if}</small
	>{/snippet}

{#if snapshot && revision}<div class="revision-picker">
		<div class="revision-choices">
			<ChoiceDialog
				label="Choose branch"
				title="Choose branch"
				width={320}
				maxHeight={320}
				gap={10}
			>
				{#snippet icon()}<Icon name="branch" size={18} />{/snippet}
				{#snippet children(close: () => void)}<label
						class="picker-field"
						onchange={() => chooseBranch(close)}
						>Branch<Select
							label="Branch"
							title={`Tip · ${revision.tip.slice(0, 7)}`}
							bind:value={branch}
							>{#each snapshot.branches as item (item.name)}<option value={item.name}
									>{item.name}</option
								>{/each}</Select
						></label
					>{@render when(`Branch tip ${revision.tip.slice(0, 7)} committed`, tipped)}{/snippet}
			</ChoiceDialog>
			<ChoiceDialog
				label="Choose commit"
				title="Choose commit"
				width={380}
				maxHeight={320}
				gap={10}
			>
				{#snippet icon()}<Icon name="commit" size={18} />{/snippet}
				{#snippet children(close: () => void)}<label
						class="picker-field"
						onchange={() => chooseCommit(close)}
						>Commit<Select label="Commit" title={viewed} bind:value={commit}
							>{#each snapshot.commits as item (item.hash)}<option value={item.hash}
									>{item.hash.slice(0, 7)} · {item.subject}</option
								>{/each}</Select
						></label
					>{@render when('Commit updated', committed)}{/snippet}
			</ChoiceDialog>
		</div>
		<div class="revision-summary">
			<strong title={revision.branch}>{revision.branch}</strong><small class="tip"
				>Tip · {revision.tip.slice(0, 7)}</small
			><small class:historical={!revision.atTip}>{viewed}</small>
		</div>
		{#if !revision.atTip || workspace.pinned}<button
				type="button"
				class="go-to-tip"
				aria-label="Go to tip"
				title="Go to tip"
				onclick={() => chooseBranch()}>Go to tip</button
			>{/if}
	</div>{/if}

<style>
	/* The icons and the line of what is shown share one row; a pinned commit adds Go to tip. */
	.revision-picker {
		align-items: center;
		gap: 8px;
	}
	/* The branch and commit icons are a group of their own only where a phone draws one. */
	.revision-choices {
		display: contents;
	}
	.revision-summary {
		display: grid;
		flex: 0 1 auto;
		min-width: 0;
		max-width: 210px;
		margin-inline-start: 4px;
		font-size: 13px;
		line-height: 1.35;
	}
	.revision-summary > * {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.revision-summary small {
		line-height: 1.35;
	}
	/* In its dialog a picker is a field of the dialog's width, not one of the bar. */
	.picker-field {
		display: grid;
		gap: 6px;
		width: auto;
		max-width: none;
	}
	.picker-field :global(.report-select) {
		display: block;
	}
	/* On a phone the icons end the bar's rail, after the environment, and Go to tip ends its row.
	   The branch and what is shown take a whole line beneath, so neither is cut short; the tip is
	   named in the branch dialog, with when it was committed. All keep off the bar's frame. */
	@media (max-width: 560px) {
		.revision-picker {
			display: contents;
		}
		.revision-choices {
			grid-area: revision;
			display: flex;
			justify-self: start;
			margin: 8px 0 0 -1px;
			border-radius: 0 8px 8px 0;
			background: var(--panel);
			box-shadow: inset 0 0 0 1px var(--line);
		}
		.revision-summary {
			grid-area: summary;
			display: flex;
			align-items: baseline;
			gap: 8px;
			min-width: 0;
			max-width: none;
			margin: 2px 0 0;
			padding-inline: 6px;
			line-height: 13px;
		}
		/* A long branch gives way first; what is shown stays whole. */
		.revision-summary strong {
			flex: 0 1 auto;
			min-width: 0;
			font-size: 12px;
		}
		.revision-summary small {
			flex: none;
			font-size: 11px;
			line-height: 13px;
		}
		.tip {
			display: none;
		}
		.go-to-tip {
			grid-area: tip;
			justify-self: end;
			height: 30px;
			margin: 8px 6px 0 0;
			padding: 0 12px;
			border-color: rgb(255 208 53 / 0.5);
			border-radius: 15px;
			background: none;
			color: var(--gold);
		}
	}
</style>
