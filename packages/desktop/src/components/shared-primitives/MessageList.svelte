<!-- @harness-tier organism -->
<!-- @harness-atoms ../../../../reports/src/components/shared-primitives/atoms -->
<script lang="ts">
	import type { Workspace } from '../../lib/stores/projects-sessions/workspace.svelte';
	import type { CatalogEntity } from '../../models/development-tooling/Desktop.types';
	import type { ThreadEntry } from '../../utils/explorer-ui/commentEntries';
	import { timeLabel } from '../../utils/development-tooling/timeLabel';
	import ReferenceText from '../explorer-ui/reference-text/ReferenceText.svelte';
	let {
		messages,
		workspace,
		entity = null
	}: { messages: ThreadEntry[]; workspace: Workspace; entity?: CatalogEntity | null } = $props();
	function name(message: ThreadEntry) {
		if (message.author === 'user') return message.authorName || 'You';
		return message.provider ? message.provider + ' CLI' : 'Harness';
	}
	function badge(message: ThreadEntry) {
		if (message.author !== 'user') return '◈';
		const words = (message.authorName || '').split(/\s+/).filter(Boolean);
		return words.length
			? words
					.map((word) => word[0].toUpperCase())
					.slice(0, 2)
					.join('')
			: 'You';
	}
</script>

<hx-div class="messages" aria-live="polite">
	{#each messages as message (message.id)}<hx-article
			class="message"
			class:pending={message.pending}
		>
			<hx-div class="avatar" class:agent={message.author === 'agent'}>{badge(message)}</hx-div>
			<hx-div>
				<hx-div class="row">
					<hx-strong>{name(message)}</hx-strong><hx-small>{timeLabel(message.at)}</hx-small>
				</hx-div>
				{#if message.note}<hx-small class="message-note">{message.note}</hx-small>{/if}
				<hx-p><ReferenceText text={message.text} {workspace} {entity} /></hx-p>
				{#if message.detail}<hx-small>{message.detail}</hx-small>{/if}{#if message.version}<hx-small
						>Design · {message.version}</hx-small
					>{/if}
			</hx-div>
		</hx-article>{:else}<hx-p class="muted">Start a conversation about this design.</hx-p>{/each}
</hx-div>
