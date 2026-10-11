<script lang="ts">
	import type { HistoryEvent } from '../models/Desktop.types';
	let { events }: { events: HistoryEvent[] } = $props();
</script>

<section class="history">
	<h2>Entity history</h2>
	{#each events as event (event.id)}<article>
			<span class="timeline-dot"></span><strong>{event.title}</strong><small
				>{event.at} {event.commit ? '· ' + event.commit.slice(0, 7) : ''}</small
			>
			<p>{event.detail}</p>
		</article>{:else}<p class="muted">No history recorded for this entity.</p>{/each}
</section>
