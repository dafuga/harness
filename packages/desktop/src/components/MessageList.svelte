<script lang="ts">
	import type { ThreadMessage } from '../models/Desktop.types';
	let { messages }: { messages: ThreadMessage[] } = $props();
</script>

<div class="messages" aria-live="polite">
	{#each messages as message (message.id)}<article class="message">
			<div class="avatar" class:agent={message.author === 'agent'}>
				{message.author === 'user' ? 'You' : '◈'}
			</div>
			<div>
				<div class="row">
					<strong
						>{message.author === 'user'
							? 'You'
							: message.provider
								? message.provider + ' CLI'
								: 'Harness'}</strong
					><small>{message.at}</small>
				</div>
				<p>{message.text}</p>
				{#if message.version}<small>Design · {message.version}</small>{/if}
			</div>
		</article>{:else}<p class="muted">Start a conversation about this design.</p>{/each}
</div>
