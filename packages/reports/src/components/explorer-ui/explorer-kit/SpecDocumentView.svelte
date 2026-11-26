<!-- @harness-tier organism -->
<!-- @harness-atoms ../../shared-primitives/atoms -->
<!-- @harness-uid u_sp3cd0cv1w -->
<script lang="ts">
	import type { TrackerAttachment } from '../../../../../../src/utils/projects-sessions/trackerAttachment.types';
	import type { LoadSpecDocument } from './SpecDocumentView.types';
	import { renderSpecMarkdown } from '../../../lib/projects-sessions/spec-view/renderSpecMarkdown';
	import { renderSpecDiagrams } from '../../../lib/projects-sessions/spec-view/renderSpecDiagrams';

	let { attachment, load }: { attachment: TrackerAttachment; load: LoadSpecDocument } = $props();
	const request = $derived(load(attachment).catch(() => null));

	function show(content: Awaited<typeof request>) {
		return (element: HTMLElement) => {
			if (!content) return;
			element.replaceChildren(renderSpecMarkdown(content));
			void renderSpecDiagrams(element).catch(() => {});
		};
	}
</script>

{#await request}
	<hx-p class="spec-status" role="status">Loading the document…</hx-p>
{:then content}
	{#if content}
		<hx-div class="spec-markdown" {@attach show(content)}></hx-div>
	{:else}
		<hx-p class="spec-status" role="alert">
			The document is not available here yet. Try again shortly, or open it on GitHub.
		</hx-p>
	{/if}
{/await}

<style>
	:global(.spec-status) {
		margin: 0;
		color: var(--hx-color-text-supporting);
	}
	:global(.spec-markdown) {
		max-width: 760px;
		margin: 0 auto;
		line-height: 1.55;
		overflow-wrap: anywhere;
	}
	:global(.spec-markdown :is(h1, h2, h3, h4)) {
		margin: 1.2em 0 0.4em;
		line-height: 1.3;
	}
	:global(.spec-markdown h1) {
		font-size: 1.5em;
		margin-top: 0;
	}
	:global(.spec-markdown h2) {
		font-size: 1.2em;
	}
	:global(.spec-markdown h3) {
		font-size: 1.05em;
	}
	:global(.spec-markdown :is(ul, ol)) {
		padding-left: 1.4em;
	}
	:global(.spec-markdown ul) {
		list-style: disc;
	}
	:global(.spec-markdown ol) {
		list-style: decimal;
	}
	:global(.spec-markdown .spec-table) {
		overflow-x: auto;
		margin: 0.8em 0;
	}
	:global(.spec-markdown table) {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.9em;
	}
	:global(.spec-markdown :is(th, td)) {
		min-width: 6em;
		padding: var(--hx-space-8);
		border: var(--hx-border-thin) solid var(--hx-color-border);
		text-align: left;
		vertical-align: top;
		overflow-wrap: break-word;
	}
	:global(.spec-markdown th) {
		background: var(--hx-color-surface-raised);
	}
	:global(.spec-markdown pre) {
		overflow-x: auto;
		padding: var(--hx-space-12);
		border: var(--hx-border-thin) solid var(--hx-color-border);
		border-radius: var(--hx-radius-small);
		font-size: 0.85em;
		overflow-wrap: normal;
	}
	:global(.spec-markdown blockquote) {
		margin: 0.8em 0;
		padding-left: var(--hx-space-12);
		border-left: 3px solid var(--hx-color-border-strong);
		color: var(--hx-color-text-supporting);
	}
	:global(.spec-markdown img) {
		max-width: 100%;
		height: auto;
	}
	:global(.spec-markdown .spec-diagram) {
		margin: 0.8em 0;
		overflow-x: auto;
		text-align: center;
	}
	:global(.spec-markdown .spec-diagram svg) {
		height: auto;
		/* Wide diagrams scroll sideways rather than shrink past reading size. */
		min-width: min(100%, 560px);
	}
</style>
