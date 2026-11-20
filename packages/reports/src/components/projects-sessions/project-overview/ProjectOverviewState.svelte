<!-- @harness-tier molecule -->
<!-- @harness-atoms ../../shared-primitives/atoms -->
<script lang="ts">
	import Pill from '../../explorer-ui/explorer-kit/Pill.svelte';
	import HarnessIcon from '../../explorer-ui/HarnessIcon.svelte';
	import { stateLabel } from './projectOverviewPresentation';
	import type { ProjectOverviewStateProps } from './ProjectOverviewState.types';
	let { state }: ProjectOverviewStateProps = $props();
</script>

<Pill tone="po-state" {state}>
	{#if state === 'done'}
		<HarnessIcon name="passed" size={12} />
	{:else}
		<hx-span class="po-mark" aria-hidden="true"></hx-span>
	{/if}
	{stateLabel(state)}
</Pill>
