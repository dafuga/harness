<!-- @harness-tier organism -->
<!-- @harness-atoms ../shared-primitives/atoms -->
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
	<hx-p class="hc-notice">
		Recorded with this history, as of commit {recorded.asOf?.commit.slice(0, 7) ?? 'none'}: it is
		what Git held when the history was built, not the state of a checkout now.
	</hx-p>
	<ProjectActivity activity={recorded} live={null} {base} />
{:else if missing}
	<hx-p class="hc-notice">
		This history was built without a record of activity. Build it again with
		<hx-code>harness history build</hx-code> to have one.
	</hx-p>
{:else}
	<hx-p class="hc-muted" role="status">Loading recorded activity…</hx-p>
{/if}
