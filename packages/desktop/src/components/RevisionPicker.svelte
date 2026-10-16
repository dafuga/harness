<script lang="ts">
	import Select from '$shared/Select.svelte';
	import type { Workspace } from '../lib/stores/workspace.svelte';
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
			>⑂ Branch<Select label="Branch" bind:value={branch}
				>{#each workspace.snapshot.branches as item (item.name)}<option value={item.name}
						>{item.name}</option
					>{/each}</Select
			><small>Tip · {revision.tip.slice(0, 7)}</small></label
		><label onchange={chooseCommit}
			>⑂ Commit<Select label="Commit" bind:value={commit}
				>{#each workspace.snapshot.commits as item (item.hash)}<option value={item.hash}
						>{item.hash.slice(0, 7)} · {item.subject}</option
					>{/each}</Select
			><small class:historical={!revision.atTip}>{viewed}</small></label
		>
		{#if !revision.atTip || workspace.pinned}<button
				type="button"
				class="go-to-tip"
				onclick={chooseBranch}>Go to tip</button
			>{/if}
	</div>{/if}
