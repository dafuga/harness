<!-- @harness-tier page -->
<!-- @harness-atoms ../../../../reports/src/components/shared-primitives/atoms -->
<!-- @harness-uid u_hy4wyfdeiv -->
<script lang="ts">
	import { resolve } from '$app/paths';
	import { getContext } from 'svelte';
	import TrackerInbox from '../../components/development-tooling/tracker-inbox/TrackerInbox.svelte';
	import { nativeAccountContext } from '../../models/development-tooling/Environment.types';
	import type { NativeAccountContext } from '../../models/development-tooling/Environment.types';
	import { phoneTrackerInboxSource } from '../../lib/development-tooling/tracker-inbox/phoneTrackerInboxSource';

	const { environment } = getContext<NativeAccountContext>(nativeAccountContext);
	const tools = environment?.tracker;
</script>

<svelte:head><title>Needs you · Harness</title></svelte:head>

<hx-a class="project-overview-link" href={resolve('/')}>Home</hx-a>

{#if tools}
	<TrackerInbox source={phoneTrackerInboxSource(tools)} />
{:else}
	<hx-p role="status"
		>The Tracker decision inbox is on the paired iPhone. Open Harness on the phone to use it.</hx-p
	>
{/if}
