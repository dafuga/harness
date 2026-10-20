<script lang="ts">
	import Select from '$shared/Select.svelte';
	import type { Workspace } from '../lib/stores/workspace.svelte';
	import Icon from './Icon.svelte';
	let { workspace }: { workspace: Workspace } = $props();
	let branch = $state('');
	let commit = $state('');
	const revision = $derived(workspace.snapshot?.revision);
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
	function chooseBranch() {
		void workspace.navigate(workspace.link({ branch }));
	}
	function chooseCommit() {
		void workspace.navigate(workspace.link({ branch, commit }));
	}
</script>

{#if workspace.snapshot && revision}<div class="revision-picker">
		<label onchange={chooseBranch}
			><span class="revision-symbol" aria-hidden="true">⑂</span><Select
				label="Branch"
				bind:value={branch}
				compact
				display={branch}
				title={`${branch} · Tip · ${revision.tip.slice(0, 7)}`}
				>{#each workspace.snapshot.branches as item (item.name)}<option value={item.name}
						>{item.name}</option
					>{/each}</Select
			><small>Tip · {revision.tip.slice(0, 7)}</small></label
		><label onchange={chooseCommit}
			><span class="revision-symbol" aria-hidden="true">#</span><Select
				label="Commit"
				bind:value={commit}
				compact
				display={commit.slice(0, 7)}
				title={`${commit} · ${viewed}`}
				>{#each workspace.snapshot.commits as item (item.hash)}<option value={item.hash}
						>{item.hash.slice(0, 7)} · {item.subject}</option
					>{/each}</Select
			><small class:historical={!revision.atTip}>{viewed}</small></label
		>
		{#if !revision.atTip || workspace.pinned}<button
				type="button"
				class="go-to-tip"
				aria-label="Go to tip"
				title="Go to tip"
				onclick={chooseBranch}><Icon name="open" size={16} /></button
			>{/if}
	</div>{/if}

<style>
	.revision-picker {
		align-self: center;
		flex: none;
		margin-left: auto;
		display: flex;
		align-items: center;
		gap: 6px;
		max-width: 100%;
		border-left: 1px solid var(--line);
		padding-left: 12px;
	}
	.revision-picker label {
		position: relative;
		flex: none;
		width: 116px;
		min-width: 0;
		font-size: 12px;
		line-height: 1.2;
	}
	.revision-picker label:first-child {
		width: 160px;
	}
	.revision-picker .revision-symbol {
		position: absolute;
		inset-inline-start: 9px;
		top: 50%;
		transform: translateY(-50%);
		z-index: 1;
		color: var(--muted);
		pointer-events: none;
	}
	.revision-picker small {
		display: none;
	}
	.revision-picker :global(.report-select) {
		display: block;
	}
	.revision-picker :global(select) {
		padding-inline-start: 28px;
		font: inherit;
		border-radius: 6px;
	}
	.revision-picker :global(.report-select-value) {
		inset-inline-start: 28px;
	}
	.revision-picker .go-to-tip {
		width: 32px;
		min-width: 32px;
		height: 32px;
		min-height: 32px;
		padding: 0;
		border-radius: 6px;
	}
	@media (pointer: coarse) {
		.revision-picker .go-to-tip {
			width: 44px;
			min-width: 44px;
			height: 44px;
		}
	}
</style>
