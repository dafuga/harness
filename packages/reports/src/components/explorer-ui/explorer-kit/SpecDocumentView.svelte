<!-- @harness-tier organism -->
<!-- @harness-atoms ../../shared-primitives/atoms -->
<!-- @harness-uid u_sp3cd0cv1w -->
<!-- @harness-uid u_mcvctd4jcs -->
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
		font-size: var(--hx-type-size-body);
		line-height: var(--hx-style-leading-normal);
		overflow-wrap: anywhere;
	}
	/* The host app styles bare paragraphs as cards; a document reads as plain text. */
	:global(.spec-dialog .spec-markdown :is(p, li, blockquote p)) {
		margin: var(--hx-space-10) 0;
		padding: 0;
		border: 0;
		border-radius: 0;
		background: none;
		font-size: inherit;
		line-height: inherit;
	}
	:global(.spec-markdown :is(h1, h2, h3, h4)) {
		margin: var(--hx-space-20) 0 var(--hx-space-6);
		line-height: var(--hx-style-leading-snug);
	}
	:global(.spec-dialog .spec-markdown h1) {
		font-size: var(--hx-type-size-2xl);
		margin-top: 0;
	}
	:global(.spec-markdown h2) {
		font-size: var(--hx-type-size-xl);
	}
	:global(.spec-markdown h3) {
		font-size: var(--hx-type-size-lg);
	}
	:global(.spec-markdown :is(ul, ol)) {
		padding-left: var(--hx-space-22);
	}
	:global(.spec-markdown ul) {
		list-style: disc;
	}
	:global(.spec-markdown ol) {
		list-style: decimal;
	}
	:global(.spec-markdown .spec-table) {
		overflow-x: auto;
		margin: var(--hx-space-12) 0;
	}
	:global(.spec-markdown table) {
		width: 100%;
		border-collapse: collapse;
		font-size: var(--hx-type-size-inline);
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
		font-size: var(--hx-type-size-compact);
		overflow-wrap: normal;
	}
	:global(.spec-markdown blockquote) {
		margin: var(--hx-space-12) 0;
		padding-left: var(--hx-space-12);
		border-left: var(--hx-border-heavy) solid var(--hx-color-border-strong);
		color: var(--hx-color-text-supporting);
	}
	:global(.spec-markdown img) {
		max-width: 100%;
		height: auto;
	}
	:global(.spec-markdown .spec-diagram) {
		margin: var(--hx-space-12) 0;
		overflow-x: auto;
		/* A wide diagram must not widen the document around it. */
		contain: inline-size;
	}
	:global(.spec-markdown .spec-diagram svg) {
		display: block;
		max-width: none;
		margin: 0 auto;
	}
</style>
