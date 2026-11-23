<!-- @harness-tier page -->
<!-- @harness-atoms ../../../../reports/src/components/shared-primitives/atoms -->
<!-- @harness-uid u_5ss75lisl2 -->
<script lang="ts">
	import { getContext, onMount } from 'svelte';
	import ProjectOverview from '$shared/projects-sessions/project-overview/ProjectOverview.svelte';
	import type { OverviewSnapshot } from '$reports/lib/projects-sessions/project-overview/projectOverview.types';
	import { nativeAccountContext } from '../../models/development-tooling/Environment.types';
	import type { NativeAccountContext } from '../../models/development-tooling/Environment.types';
	import { ProjectSyncService } from '../../services/projects-sessions/ProjectSyncService';

	const { environment } = getContext<NativeAccountContext>(nativeAccountContext);
	const bridge = environment?.bridge;
	const unavailable: OverviewSnapshot = { status: 'unavailable' };
	let snapshot = $state<OverviewSnapshot | null>(null);

	onMount(() => {
		let asked = 0;
		const reload = async () => {
			const ticket = ++asked;
			const value = await bridge?.projectOverview?.().catch(() => unavailable);
			if (ticket === asked) snapshot = value ?? unavailable;
		};
		const release = bridge?.onCacheStatus?.(({ status }) => {
			if (status !== 'denied') return;
			asked++;
			snapshot = unavailable;
		});
		const sync = new ProjectSyncService({ refresh: reload });
		void reload();
		if (bridge) sync.start();
		return () => {
			asked++;
			sync.stop();
			release?.();
		};
	});
</script>

<svelte:head><title>Projects · Harness</title></svelte:head>

<ProjectOverview {snapshot} homeHref="/" />
