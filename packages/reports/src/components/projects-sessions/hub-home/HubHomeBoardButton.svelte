<!-- @harness-tier molecule -->
<!-- @harness-atoms ../../shared-primitives/atoms -->
<!-- @harness-uid u_ycwbrdbutn -->
<script lang="ts">
	import { tick } from 'svelte';
	import type { LinkedHome } from '$reports/lib/projects-sessions/hub-home/homeLive.types';
	import HubHomeBoard from './HubHomeBoard.svelte';

	let { reading, now }: { reading: LinkedHome | null; now: number } = $props();
	let open = $state(false);
	let trigger: HTMLButtonElement | undefined;

	function close() {
		open = false;
		void tick().then(() => trigger?.focus());
	}
</script>

<hx-button
	type="button"
	class="po-action hh-board-open"
	aria-haspopup="dialog"
	onclick={(event) => {
		trigger = event.currentTarget;
		open = true;
	}}>Board</hx-button
>
{#if open}<HubHomeBoard {reading} {now} {close} />{/if}
