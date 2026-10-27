<!-- @harness-tier organism -->
<!-- @harness-atoms ../../../../reports/src/components/shared-primitives/atoms -->
<script lang="ts">
	import type { FeatureWorkSnapshot } from '../../../../../src/services/agents-providers/FeatureWorkService.types';
	import ProjectWorkFeature from './ProjectWorkFeature.svelte';
	import '../../lib/styles/agents-providers/projectWork.css';
	let {
		snapshot,
		loading,
		error
	}: { snapshot: FeatureWorkSnapshot | null; loading: boolean; error: string | null } = $props();
	const short = (commit: string) => commit.slice(0, 7);
</script>

<hx-section data-harness-component="project-work" aria-label="Project work" aria-busy={loading}>
	<hx-h2>Work</hx-h2>
	<hx-p class="meta" role="status">
		{#if loading}{snapshot ? 'Refreshing committed work…' : 'Loading committed work…'}{/if}
	</hx-p>
	{#if error}
		<hx-p class="alert" role="alert"
			>{snapshot ? 'Showing the last read; it may be stale.' : 'Work could not be read.'}
			{error}</hx-p
		>
	{/if}
	{#if !snapshot}
		{#if !loading && !error}<hx-p>Feature work is unavailable for this project.</hx-p>{/if}
	{:else}
		<hx-p class="meta" title={snapshot.queueCommit}>
			{snapshot.queueCommit
				? `Queue commit ${short(snapshot.queueCommit)}`
				: 'The queue has no commit yet.'}
		</hx-p>
		{#if !snapshot.features.length}
			<hx-p>No features are committed to this queue.</hx-p>
		{:else}
			<hx-ul>
				{#each snapshot.features as f, i (f.id)}
					<ProjectWorkFeature feature={f} initiallyOpen={i === 0} />
				{/each}
			</hx-ul>
		{/if}
	{/if}
</hx-section>
