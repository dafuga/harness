<!-- @harness-tier organism -->
<!-- @harness-atoms ../../shared-primitives/atoms -->
<script lang="ts">
	import { onMount } from 'svelte';
	import type { Shown } from '../../../../../../src/workflows/runActivity';
	import { activityClient } from './activityClient';
	import ProjectActivity from '../project-activity/ProjectActivity.svelte';
	let { shown }: { shown: Shown } = $props();
	let arrived = $state<Shown | null>(null);
	let failed = $state(false);
	let clock = $state<number | null>(null);
	let client: ReturnType<typeof activityClient> | undefined;
	let current = $derived(arrived ?? shown);
	// Until the page runs in a browser the reading is as old as itself; then time passes.
	let now = $derived(clock ?? Date.parse(current.live.sampledAt));
	onMount(() => {
		clock = Date.now();
		const ticking = setInterval(() => (clock = Date.now()), 5_000);
		client = activityClient(
			(read) => {
				arrived = read;
				failed = false;
				clock = Date.now();
			},
			() => {
				failed = true;
				clock = Date.now();
			}
		);
		return () => {
			clearInterval(ticking);
			client?.stop();
		};
	});
</script>

<ProjectActivity
	activity={current.activity}
	live={current.live}
	base="/harness"
	reading={{ now, failed, refresh: () => void client?.refresh() }}
/>
