<!-- @harness-tier page -->
<!-- @harness-atoms ../../../../reports/src/components/shared-primitives/atoms -->
<!-- @harness-uid u_hy4wyfdeiv -->
<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { getContext } from 'svelte';
	import TrackerWork from '../../components/development-tooling/TrackerWork.svelte';
	import TrackerInbox from '../../components/development-tooling/tracker-inbox/TrackerInbox.svelte';
	import { nativeAccountContext } from '../../models/development-tooling/Environment.types';
	import type { NativeAccountContext } from '../../models/development-tooling/Environment.types';
	import { phoneTrackerInboxSource } from '../../lib/development-tooling/tracker-inbox/phoneTrackerInboxSource';

	const account = getContext<NativeAccountContext>(nativeAccountContext);
	const environment = $derived(account.environment);
	const work = $derived(page.url.searchParams.get('view') === 'work');
	const phone = $derived(
		environment?.tracker ? phoneTrackerInboxSource(environment.tracker) : undefined
	);
	const local = $derived(
		environment?.kind === 'electron' ? environment.bridge?.trackerInbox : undefined
	);
</script>

<svelte:head><title>{work ? 'Plans and schedule' : 'Needs you'} · Harness</title></svelte:head>

<hx-a class="project-overview-link" href={resolve('/')}>Home</hx-a>

{#if work && environment?.trackerHome}
	<TrackerWork source={environment.trackerHome} mac={environment.kind === 'electron'} />
{:else if local}
	<TrackerInbox source={local} mode="mac" />
{:else if phone}
	<TrackerInbox source={phone} />
{:else}
	<hx-p role="status"
		>The Tracker decision inbox is on the paired iPhone. Open Harness on the phone to use it.</hx-p
	>
{/if}
