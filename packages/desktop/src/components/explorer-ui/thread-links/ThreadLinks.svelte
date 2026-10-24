<!-- @harness-tier molecule -->
<!-- @harness-atoms ../../../../../reports/src/components/shared-primitives/atoms -->
<script lang="ts">
	import type { ThreadInfo } from '../../../models/development-tooling/Desktop.types';
	import { sameImage } from './threadAnchor';
	import { type ThreadTarget } from '../../../utils/explorer-ui/threadAnchor';
	let {
		threads,
		thread,
		aim,
		select
	}: {
		threads: ThreadInfo[];
		thread: ThreadInfo | null;
		aim: ThreadTarget;
		select: (thread: ThreadInfo) => void;
	} = $props();
	/** The earlier threads of the exact image in view come first. */
	const groups = $derived(
		[
			{ label: 'Threads on this image', items: threads.filter((item) => sameImage(aim, item)) },
			{ label: 'Other threads', items: threads.filter((item) => !sameImage(aim, item)) }
		].filter((group) => group.items.length)
	);
</script>

{#each groups as group (group.label)}<hx-div
		class="thread-links"
		role="group"
		aria-label={group.label}
	>
		<hx-small>{group.label}</hx-small>{#each group.items as item (item.id)}<hx-button
				type="button"
				class:active={thread?.id === item.id}
				aria-pressed={thread?.id === item.id}
				onclick={() => select(item)}>Thread {item.pin} · {item.version || 'Initial plan'}</hx-button
			>{/each}
	</hx-div>{/each}
