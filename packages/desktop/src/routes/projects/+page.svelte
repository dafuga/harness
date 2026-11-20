<!-- @harness-tier page -->
<!-- @harness-atoms ../../../../reports/src/components/shared-primitives/atoms -->
<!-- @harness-uid u_5ss75lisl2 -->
<script lang="ts">
	import { onMount } from 'svelte';
	import ProjectOverview from '$shared/projects-sessions/project-overview/ProjectOverview.svelte';
	import type { OverviewSnapshot } from '$reports/lib/projects-sessions/project-overview/projectOverview.types';
	import type { DesktopBridge } from '../../models/development-tooling/DesktopBridge.types';
	import type { EnvironmentHost } from '../../models/development-tooling/Environment.types';
	import { selectEnvironment } from '../../lib/verification-evidence/select-environment/selectEnvironment';
	import '../../lib/styles/workspace.css';
	import '../../lib/styles/design.css';

	const unavailable: OverviewSnapshot = { status: 'unavailable' };
	/** Null only while the snapshot is read. Anywhere but the desktop app the overview is unavailable. */
	let snapshot = $state<OverviewSnapshot | null>(null);

	/** One zero-argument read of the local tracker. A refusal or a failure reads as unavailable. */
	async function read(bridge: DesktopBridge | undefined): Promise<OverviewSnapshot> {
		try {
			return (await bridge?.projectOverview?.()) ?? unavailable;
		} catch {
			return unavailable;
		}
	}

	onMount(() => {
		const environment = selectEnvironment(window as unknown as EnvironmentHost);
		const bridge = environment.kind === 'electron' ? environment.bridge : undefined;
		void read(bridge).then((value) => {
			snapshot = value;
		});
	});
</script>

<svelte:head><title>Projects · Harness</title></svelte:head>

<ProjectOverview {snapshot} homeHref="/" />
