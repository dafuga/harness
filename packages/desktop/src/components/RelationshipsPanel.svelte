<script lang="ts">
	import { explorerName } from '../../../reports/src/utils/explorerName';
	import type { Relationship } from '../models/Desktop.types';
	import type { Workspace } from '../lib/stores/workspace.svelte';
	import PlanBadge from './PlanBadge.svelte';
	import StatusIcon from './StatusIcon.svelte';
	import Icon from './Icon.svelte';
	import WorkspaceLink from './WorkspaceLink.svelte';
	let {
		relationships,
		workspace,
		title = 'Relationships'
	}: { relationships: Relationship[]; workspace: Workspace; title?: string } = $props();
	/** A related entity is named in words, as it is where it is listed and opened. */
	const named = (item: Relationship) => explorerName({ id: item.id, kind: '', title: item.title });
</script>

<section class="panel">
	<h2>{title}</h2>
	<div class="relationships">
		{#each relationships as item (`${item.direction}:${item.id}`)}<article class="relationship">
				<Icon name={item.category || 'components'} />
				<div>
					<small>{item.direction === 'uses' ? 'Uses' : 'Used by'}</small
					>{#if item.category}<WorkspaceLink {workspace} to={workspace.path(item.category, item.id)}
							>{named(item)}</WorkspaceLink
						>{:else}<span>{named(item)}</span>{/if}
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
