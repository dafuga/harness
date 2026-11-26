let drawn = 0;

/**
 * Draw each fenced mermaid block. Mermaid is large, so it loads only when a document has one.
 * A block that cannot be drawn stays readable as its source.
 */
export async function renderSpecDiagrams(root: HTMLElement): Promise<void> {
	const blocks = [...root.querySelectorAll('pre > code.language-mermaid')];
	if (!blocks.length) return;
	const { default: mermaid } = await import('mermaid');
	mermaid.initialize({
		startOnLoad: false,
		securityLevel: 'strict',
		theme: darkPage(root) ? 'dark' : 'neutral'
	});
	// Mermaid keeps shared state while it draws, so diagrams are drawn one at a time.
	for (const block of blocks) {
		if (!root.isConnected) return;
		await drawDiagram(mermaid, block);
	}
}

async function drawDiagram(mermaid: typeof import('mermaid').default, block: Element) {
	const source = block.textContent ?? '';
	const id = `spec-diagram-${++drawn}`;
	try {
		const { svg } = await mermaid.render(id, source);
		const figure = block.ownerDocument.createElement('figure');
		figure.className = 'spec-diagram';
		figure.tabIndex = 0;
		figure.innerHTML = svg;
		removeRemoteImages(figure);
		block.parentElement?.replaceWith(figure);
	} catch {
		block.parentElement?.setAttribute('data-diagram', 'failed');
		block.ownerDocument.getElementById(`d${id}`)?.remove();
	}
}

function removeRemoteImages(figure: HTMLElement) {
	for (const image of figure.querySelectorAll('image, img')) {
		const source = image.getAttribute('href') ?? image.getAttribute('src') ?? '';
		if (!source.startsWith('data:')) image.remove();
	}
}

function darkPage(root: HTMLElement) {
	const color = getComputedStyle(root).color.match(/\d+(\.\d+)?/g)?.map(Number) ?? [0, 0, 0];
	// Light text means a dark page, whichever way the theme was chosen.
	return (color[0] + color[1] + color[2]) / 3 > 128;
}
