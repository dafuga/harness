<script lang="ts">
	import { onMount, type Component as SvelteComponent } from 'svelte';
	import {
		nativeAtoms,
		svgElements
	} from '../../../../../../src/templates/development-tooling/htmlElements.js';
	import { nativeAtomProps } from './nativeAtomProps';
	let {
		Component,
		source
	}: { Component: SvelteComponent<Record<string, unknown>>; source: string } = $props();
	const name = source.split('/').at(-1)?.replace('.svelte', '');
	const definition = nativeAtoms.find((atom) => atom.name === name)!;
	const tag = definition.tag;
	const attributes = nativeAtomProps(tag, definition.type);
	let host: HTMLElement;
	onMount(() => {
		const canvas = host.querySelector('canvas');
		const context = canvas?.getContext('2d');
		if (context && canvas) {
			context.fillStyle = getComputedStyle(canvas).color;
			context.fillRect(12, 12, 100, 42);
		}
	});
</script>

{#snippet content()}
	{#if ['input', 'img', 'hr', 'video', 'audio', 'iframe', 'canvas', 'embed', 'object'].includes(tag)}{:else if tag === 'select' || tag === 'optgroup'}<option
			value="example">Example choice</option
		>
	{:else if tag === 'table'}<tbody><tr><td>Example cell</td></tr></tbody>
	{:else if ['thead', 'tbody', 'tfoot'].includes(tag)}<tr><td>Example cell</td></tr>
	{:else if tag === 'tr'}<td>Example cell</td>
	{:else if ['ul', 'ol', 'menu'].includes(tag)}<li>Example item</li>
	{:else if tag === 'dl'}<div>
			<dt>Label</dt>
			<dd>Example value</dd>
		</div>
	{:else if tag === 'details'}<summary>Example details</summary>
		<p>Expanded content</p>
	{:else if tag === 'form' || tag === 'fieldset'}<label
			>Example field <input value="Example" /></label
		><button type="button">Continue</button>
	{:else if tag === 'picture'}<img
			src={nativeAtomProps('img').src as string}
			alt="Example image"
			width="180"
			height="110"
		/>
	{:else if tag === 'svg' || tag === 'g'}<rect
			x="12"
			y="12"
			width="72"
			height="44"
			rx="4"
			fill="currentColor"
		/>
	{:else if ['circle', 'ellipse', 'line', 'path', 'polyline', 'polygon', 'rect', 'use', 'image'].includes(tag)}{:else if tag === 'foreignObject'}<p
		>
			Embedded content
		</p>
	{:else}{name}{/if}
{/snippet}

<div class="atom-host" bind:this={host}>
	{#if svgElements.includes(tag) && tag !== 'svg'}
		<svg width="180" height="80" viewBox="0 0 180 80" aria-label="Native SVG element context">
			<defs
				><path id="atom-shape" d="M12 60 45 15 78 60Z" fill="currentColor" /><path
					id="atom-path"
					d="M12 42h156"
				/></defs
			>
			{#if tag === 'tspan' || tag === 'textPath'}<text
					><Component {...attributes} children={content} /></text
				>
			{:else}<Component {...attributes} children={content} />{/if}
		</svg>
	{:else if ['caption', 'thead', 'tbody', 'tfoot'].includes(tag)}
		<table><Component {...attributes} children={content} /></table>
	{:else if tag === 'tr'}<table>
			<tbody><Component {...attributes} children={content} /></tbody>
		</table>
	{:else if tag === 'td' || tag === 'th'}<table>
			<tbody><tr><Component {...attributes} children={content} /></tr></tbody>
		</table>
	{:else if tag === 'li'}<ul><Component {...attributes} children={content} /></ul>
	{:else if tag === 'dt' || tag === 'dd'}<dl><Component {...attributes} children={content} /></dl>
	{:else if tag === 'option' || tag === 'optgroup'}<select aria-label="Native option context"
			><Component {...attributes} children={content} /></select
		>
	{:else if tag === 'legend'}<fieldset><Component {...attributes} children={content} /></fieldset>
	{:else if tag === 'summary'}<details open>
			<Component {...attributes} children={content} />
		</details>
	{:else if tag === 'rt' || tag === 'rp'}<ruby
			>Example<Component {...attributes} children={content} /></ruby
		>
	{:else}<Component {...attributes} children={content} />{/if}
</div>

<style>
	.atom-host {
		display: contents;
	}
	fieldset,
	table,
	ul,
	dl,
	details {
		width: max-content;
		max-width: 100%;
	}
</style>
