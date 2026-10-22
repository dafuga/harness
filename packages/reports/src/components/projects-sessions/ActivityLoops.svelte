<script lang="ts">
	import type { ProjectActivity } from '../../../../../src/core/activityTypes';
	import { activityTime, plural } from '../../utils/projects-sessions/activityDisplay';
	let { loops }: { loops: ProjectActivity['loops'] } = $props();
</script>

<section class="pa-card" aria-label="Loop types">
	<div class="pa-head">
		<h2>Loop types this project uses</h2>
		<span class="pa-note">{plural(loops.total, 'tracked loop')}</span>
	</div>
	{#if loops.types.length}
		<ul class="pa-list" aria-label="Loop types">
			{#each loops.types as type (type.template)}
				<li>
					<div class="pa-row">
						<strong>{type.template}</strong>
						<span>{plural(type.loops, 'loop')} · {type.complete} complete · {type.open} open</span>
					</div>
					<small>Last used {activityTime(type.lastUsedAt)} UTC · {type.names.join(', ')}</small>
				</li>
			{/each}
		</ul>
	{:else}
		<p class="pa-empty">No loop is tracked in this repository.</p>
	{/if}
</section>
