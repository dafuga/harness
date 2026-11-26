/** Runs in the page: the name of each component marker drawn in the window, or anywhere. */
export function markersInView(whole: boolean): string[] {
	const boxOf = (element: Element): DOMRect => {
		if (getComputedStyle(element).display !== 'contents') return element.getBoundingClientRect();
		// A marker that draws no box of its own stands for the boxes of what it holds.
		const parts = [...element.children].map(boxOf).filter((box) => box.width * box.height > 0);
		if (parts.length === 0) return new DOMRect();
		const left = Math.min(...parts.map((box) => box.left));
		const top = Math.min(...parts.map((box) => box.top));
		const right = Math.max(...parts.map((box) => box.right));
		const bottom = Math.max(...parts.map((box) => box.bottom));
		return new DOMRect(left, top, right - left, bottom - top);
	};
	// In the window: at least half of what of it could fit there is inside it, and it is not hidden.
	const drawn = (element: Element) => {
		const box = boxOf(element);
		const style = getComputedStyle(element);
		if (box.width * box.height === 0 || style.visibility === 'hidden' || style.opacity === '0')
			return false;
		const width = Math.max(0, Math.min(box.right, innerWidth) - Math.max(box.left, 0));
		const height = Math.max(0, Math.min(box.bottom, innerHeight) - Math.max(box.top, 0));
		const fits = Math.min(box.width * box.height, innerWidth * innerHeight);
		return whole || width * height >= fits / 2;
	};
	const marked = [...document.querySelectorAll('[data-harness-component]')].filter(drawn);
	const names = marked.map((element) => element.getAttribute('data-harness-component') ?? '');
	return [...new Set(names)];
}
