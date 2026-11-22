<!-- @harness-tier page -->
<!-- @harness-atoms ../../../components/shared-primitives/atoms -->
<!-- @harness-uid u_5pg3d5ivbw -->
<script lang="ts">
	import { onMount } from 'svelte';
	import ExplorerLayout from '../../../components/explorer-ui/ExplorerLayout.svelte';
	import ProjectOverview from '../../../components/projects-sessions/project-overview/ProjectOverview.svelte';
	import type { OverviewSnapshot } from '../../../lib/projects-sessions/project-overview/projectOverview.types';
	import '../../../lib/styles/harness.css';

	const base = '/harness';
	const endpoint = '/api/project-overview';

	// Null only while the first read is pending. A read that fails, is refused or is not ready
	// is unavailable: the page never shows a partial or raw answer.
	let snapshot = $state.raw<OverviewSnapshot | null>(null);

	async function read(): Promise<OverviewSnapshot> {
		try {
			const response = await fetch(endpoint, {
				cache: 'no-store',
				credentials: 'same-origin',
				headers: { accept: 'application/json' }
			});
			const body = (await response.json()) as OverviewSnapshot;
			return body.status === 'ready' ? body : { status: 'unavailable' };
		} catch {
			return { status: 'unavailable' };
		}
	}

	onMount(async () => {
		snapshot = await read();
	});
</script>

<svelte:head><title>Projects · Harness</title></svelte:head>

<ExplorerLayout
	{base}
	problem=""
	missing={null}
	navbar={{
		projects: { href: `${base}/projects`, active: true },
		repository: null,
		scope: null,
		index: null,
		commits: [],
		href: () => base,
		onroute: () => {}
	}}
>
	<ProjectOverview {snapshot} homeHref={base} standalone={false} />
</ExplorerLayout>
