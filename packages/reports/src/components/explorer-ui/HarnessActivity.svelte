<script lang="ts">
	import type { ProjectActivity as Recorded } from '../../../../../src/core/activityTypes';
	import type { HarnessClient } from '../../utils/explorer-ui/harnessClient';
	import ProjectActivity from '../projects-sessions/project-activity/ProjectActivity.svelte';
	let { client, base }: { client: HarnessClient; base: string } = $props();
	let recorded = $state<Recorded | null>(null);
	let missing = $state(false);
	$effect(() => {
		client.activity().then(
			(found) => (recorded = found),
			() => (missing = true)
		);
	});
</script>

{#if recorded}
	<p class="hc-notice">
		Recorded with this history, as of commit {recorded.asOf?.commit.slice(0, 7) ?? 'none'}: it is
		what Git held when the history was built, not the state of a checkout now.
	</p>
	<ProjectActivity activity={recorded} live={null} {base} />
{:else if missing}
	<p class="hc-notice">
		This history was built without a record of activity. Build it again with
		<code>harness history build</code> to have one.
	</p>
{:else}
	<p class="hc-muted" role="status">Loading recorded activity…</p>
{/if}
