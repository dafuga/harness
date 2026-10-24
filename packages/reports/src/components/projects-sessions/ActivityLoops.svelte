<!-- @harness-tier molecule -->
<!-- @harness-atoms ../shared-primitives/atoms -->
<script lang="ts">
	import type { ProjectActivity } from '../../../../../src/core/activityTypes';
	import { activityTime } from '../../utils/projects-sessions/activityDisplay';
	import { plural } from '../../helpers/strings/plural';
	let { loops }: { loops: ProjectActivity['loops'] } = $props();
</script>

<hx-section class="pa-card" aria-label="Loop types">
	<hx-div class="pa-head">
		<hx-h2>Loop types this project uses</hx-h2>
		<hx-span class="pa-note">{plural(loops.total, 'tracked loop')}</hx-span>
	</hx-div>
	{#if loops.types.length}
		<hx-ul class="pa-list" aria-label="Loop types">
			{#each loops.types as type (type.template)}
				<hx-li>
					<hx-div class="pa-row">
						<hx-strong>{type.template}</hx-strong>
						<hx-span
							>{plural(type.loops, 'loop')} · {type.complete} complete · {type.open} open</hx-span
						>
					</hx-div>
					<hx-small
						>Last used {activityTime(type.lastUsedAt)} UTC · {type.names.join(', ')}</hx-small
					>
				</hx-li>
			{/each}
		</hx-ul>
	{:else}
		<hx-p class="pa-empty">No loop is tracked in this repository.</hx-p>
	{/if}
</hx-section>
