<!-- @harness-tier molecule -->
<!-- @harness-atoms ../../../../reports/src/components/shared-primitives/atoms -->
<!-- @harness-uid u_eqr4mg5wut -->
<script lang="ts">
	import type { Section } from './entity-view/EntityView.types';
	let {
		names,
		tab,
		threadShown,
		onpick,
		onconversation
	}: {
		names: Section[];
		tab: Section;
		/** Whether the conversation panel is open; when it is not, its icon button ends the row. */
		threadShown: boolean;
		onpick: (value: Section) => void;
		onconversation: () => void;
	} = $props();
</script>

<!-- One horizontally scrolling row on a phone: the sections, then the Conversation icon button. -->
<hx-nav class="entity-tabs" aria-label="Entity sections">
	{#each names as value (value)}<hx-button
			class:active={tab === value}
			aria-current={tab === value ? 'page' : undefined}
			onclick={() => onpick(value)}>{value}</hx-button
		>{/each}{#if !threadShown}<hx-button
			class="conversation-open"
			aria-label="Conversation"
			title="Conversation"
			onclick={onconversation}
			><hx-svg
				width="20"
				height="20"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="1.6"
				stroke-linecap="round"
				stroke-linejoin="round"
				aria-hidden="true"><hx-svg-path d="M4 5h16v11H9l-5 4z" /></hx-svg
			></hx-button
		>{/if}
</hx-nav>
