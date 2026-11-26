<!-- @harness-tier organism -->
<!-- @harness-atoms ../../shared-primitives/atoms -->
<!-- @harness-uid u_f6xsfq2f7u -->
<script lang="ts">
	import Modal from '../../Modal.svelte';

	let {
		question,
		maxlength,
		busy = false,
		onsend,
		onclose
	}: {
		question: string;
		maxlength: number;
		busy?: boolean;
		/** Called with the trimmed written answer; the modal closes first. */
		onsend: (text: string) => void;
		onclose: () => void;
	} = $props();
	let text = $state('');

	function send() {
		const answer = text.trim();
		if (!answer || busy) return;
		onclose();
		onsend(answer);
	}
</script>

<Modal isOpen title="Other answer" variant="text" onClose={onclose}>
	<hx-div class="other-answer">
		<hx-p class="other-answer-question">{question}</hx-p>
		<hx-textarea
			class="other-answer-field"
			aria-label="Your answer"
			placeholder="Write your answer…"
			rows="6"
			{maxlength}
			autofocus={true}
			value={text}
			oninput={(event: Event) => (text = (event.currentTarget as HTMLTextAreaElement).value)}
		></hx-textarea>
		<hx-div class="other-answer-actions">
			<hx-button type="button" class="other-answer-cancel" onclick={onclose}>Cancel</hx-button>
			<hx-button
				type="button"
				class="other-answer-send"
				disabled={busy || !text.trim()}
				onclick={send}>Send answer</hx-button
			>
		</hx-div>
	</hx-div>
</Modal>

<style>
	:global(.other-answer) {
		display: grid;
		gap: var(--hx-space-12);
		padding: var(--hx-space-16);
	}
	:global(.other-answer-question) {
		margin: 0;
		overflow-wrap: anywhere;
	}
	:global(.other-answer .other-answer-field) {
		box-sizing: border-box;
		width: 100%;
		resize: vertical;
		padding: var(--hx-space-10);
		border: var(--hx-border-thin) solid var(--hx-color-border-strong);
		border-radius: var(--hx-radius-small);
		background: var(--hx-color-background);
		color: var(--hx-color-text);
		/* 16px keeps iOS from zooming the page when the field takes focus. */
		font: inherit;
		font-size: var(--hx-type-size-base);
	}
	:global(.other-answer-actions) {
		display: flex;
		justify-content: flex-end;
		gap: var(--hx-space-8);
	}
	:global(.other-answer-actions button) {
		min-height: var(--hx-space-40);
		padding: var(--hx-space-8) var(--hx-space-16);
		border: var(--hx-border-thin) solid var(--hx-color-border-strong);
		border-radius: var(--hx-radius-compact);
		background: var(--hx-color-surface);
		color: var(--hx-color-text);
		font: inherit;
		cursor: pointer;
	}
	:global(.other-answer-actions button.other-answer-send) {
		border-color: var(--hx-color-primary);
		background: var(--hx-color-primary);
		color: var(--hx-color-primary-contrast);
	}
	:global(.other-answer-actions button:disabled) {
		opacity: var(--hx-opacity-half);
		cursor: default;
	}
</style>
