<script lang="ts">
	import type { Workspace } from '../lib/stores/workspace.svelte';
	import type { CatalogEntity } from '../models/Desktop.types';
	import type { ThreadEntry } from '../utils/commentEntries';
	import { timeLabel } from '../utils/timeLabel';
	import ReferenceText from './reference-text/ReferenceText.svelte';
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

<div class="messages" aria-live="polite">
	{#each messages as message (message.id)}<article class="message" class:pending={message.pending}>
			<div class="avatar" class:agent={message.author === 'agent'}>{badge(message)}</div>
			<div>
				<div class="row">
					<strong>{name(message)}</strong><small>{timeLabel(message.at)}</small>
				</div>
				{#if message.note}<small class="message-note">{message.note}</small>{/if}
				<p><ReferenceText text={message.text} {workspace} {entity} /></p>
				{#if message.detail}<small>{message.detail}</small>{/if}{#if message.version}<small
						>Design · {message.version}</small
					>{/if}
			</div>
		</article>{:else}<p class="muted">Start a conversation about this design.</p>{/each}
</div>
