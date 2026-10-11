<script lang="ts">
	import Select from '$shared/Select.svelte';
	import type { Workspace } from '../lib/stores/workspace.svelte';
	let { workspace }: { workspace: Workspace } = $props();
	let branch = $state('');
	let commit = $state('');
	$effect(() => {
		branch = workspace.snapshot?.revision.branch || '';
		commit = workspace.snapshot?.revision.commit || '';
	});
	function chooseBranch() {
		void workspace.navigate(`/harness/branch/${encodeURIComponent(branch)}/${workspace.category}`);
	}
	function chooseCommit() {
		void workspace.navigate(
			`/harness/branch/${encodeURIComponent(branch)}/commit/${commit}/${workspace.category}`
		);
	}
</script>

{#if workspace.snapshot}<div class="revision-picker">
		<label onchange={chooseBranch}
			>⑂ Branch<Select label="Branch" bind:value={branch}
				>{#each workspace.snapshot.branches as item (item.name)}<option value={item.name}
						>{item.name}</option
					>{/each}</Select
			><small>Tip · {workspace.snapshot.revision.tip.slice(0, 7)}</small></label
		><label onchange={chooseCommit}
			>⑂ Commit<Select label="Commit" bind:value={commit}
				>{#each workspace.snapshot.commits as item (item.hash)}<option value={item.hash}
						>{item.hash.slice(0, 7)} · {item.subject}</option
					>{/each}</Select
			><small
				>{workspace.snapshot.revision.atTip
					? 'Current · branch tip'
					: 'Historical · read-only'}</small
			></label
		>
		<button type="button" style:align-self="center" onclick={chooseBranch}>Go to tip</button>
	</div>{/if}
