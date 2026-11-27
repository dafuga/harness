<!-- @harness-tier organism -->
<!-- @harness-atoms ../../../../reports/src/components/shared-primitives/atoms -->
<!-- @harness-uid u_tred5euwjc -->
<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import DesignCanvas from '$shared/planning-collaboration/design-canvas/DesignCanvas.svelte';
	import DesignsHeader from '$shared/planning-collaboration/DesignsHeader.svelte';
	import type { DesignCanvasPage } from '$reports/utils/planning-collaboration/designCanvas.types';
	import { browserContext } from '../../utils/development-tooling/browserContext';
	let {
		projectId,
		canvas,
		branch,
		commit
	}: {
		projectId: string;
		canvas: string | null;
		branch: string | null;
		commit: string | null;
	} = $props();
	const { api } = browserContext();
	let shown = $state<DesignCanvasPage | null>(null);
	let failure = $state('');
	let attempt = $state(0);
	/** Only the answer to the latest address is shown. */
	let asked = 0;
	const address = (canvas: string | undefined, branch: string) =>
		resolve('/projects/[projectId]/designs/[[canvas]]', { projectId, canvas }) +
		`?branch=${encodeURIComponent(branch)}`;

	function chooseBranch(branch: string) {
		// eslint-disable-next-line svelte/no-navigation-without-resolve -- address resolves the route before adding its branch
		void goto(address(undefined, branch));
	}

	$effect(() => {
		void attempt;
		const turn = ++asked;
		const path = `/api/projects/${encodeURIComponent(projectId)}/designs`;
		failure = '';
		api.get<DesignCanvasPage>(path, { branch, commit, canvas }).then(
			(answer) => {
				if (turn === asked) shown = answer;
			},
			(cause: unknown) => {
				if (turn !== asked) return;
				shown = null;
				failure = cause instanceof Error ? cause.message : 'The designs could not be read.';
			}
		);
		return () => asked++;
	});
</script>

<svelte:head><title>Harness · Designs</title></svelte:head>

<hx-div class="designs-page">
	<DesignsHeader
		page={shown}
		pinned={Boolean(commit)}
		workspace={resolve('/projects/[projectId]/harness/[...path]', { projectId, path: 'pages' })}
		onreload={() => attempt++}
		onbranch={chooseBranch}
		canvasHref={address}
	/>
	{#if failure}<hx-p class="designs-note" role="alert">{failure}</hx-p>
	{:else if !shown}<hx-p class="designs-note" role="status">Loading designs…</hx-p>
	{:else if shown.canvas}<DesignCanvas canvas={shown.canvas} />
	{:else}<hx-p class="designs-note">
			No canvas on this branch. An agent adds one with <hx-code>harness design new</hx-code> and lands
			it in a pull request.
		</hx-p>{/if}
</hx-div>

<style>
	.designs-page {
		display: flex;
		flex-direction: column;
		height: 100dvh;
		background: var(--hx-color-background);
		color: var(--hx-color-text);
	}
	.designs-note {
		margin: 0;
		padding: var(--hx-space-32) var(--hx-space-24);
		text-align: center;
	}
</style>
