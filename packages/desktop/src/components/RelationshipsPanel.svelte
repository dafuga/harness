<script lang="ts">
	import { resolve } from '$app/paths';
	import type { Relationship } from '../models/Desktop.types';
	import type { Workspace } from '../lib/stores/workspace.svelte';
	import PlanBadge from './PlanBadge.svelte';
	import StatusIcon from './StatusIcon.svelte';
	import Icon from './Icon.svelte';
	let { relationships, workspace }: { relationships: Relationship[]; workspace: Workspace } =
		$props();
</script>

<section class="panel">
	<h2>Relationships</h2>
	<div class="relationships">
		{#each relationships as item (`${item.direction}:${item.id}`)}<article class="relationship">
				<Icon name={item.category || 'components'} />
				<div>
					<small>{item.direction === 'uses' ? 'Uses' : 'Used by'}</small>{#if item.category}<a
							href={resolve('/harness/[...path]', {
								path: workspace.path(item.category, item.id).slice(9)
							})}
							onclick={(e) => {
								e.preventDefault();
								void workspace.navigate(workspace.path(item.category!, item.id));
							}}>{item.title}</a
						>{:else}<span>{item.title}</span>{/if}
				</div>
				{#if item.hasPlan}<PlanBadge />{/if}<StatusIcon
					status={item.verification}
					reason={item.verification === 'verified'
						? 'Verification recorded for this revision.'
						: 'No passing verification recorded for this revision.'}
				/>
			</article>{:else}<p class="muted">No relationships recorded.</p>{/each}
	</div>
</section>
