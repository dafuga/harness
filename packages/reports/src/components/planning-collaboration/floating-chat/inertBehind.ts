// @harness-uid u_alymhuf2pk
/**
 * Makes everything outside `node` inert: each sibling of its ancestors, so the page behind an open
 * sheet takes no pointer or keyboard. Returns the function that restores what it changed.
 */
export function inertBehind(node: HTMLElement): () => void {
	const marked: HTMLElement[] = [];
	let child: HTMLElement = node;
	while (child.parentElement) {
		for (const sibling of Array.from(child.parentElement.children)) {
			if (sibling === child || !(sibling instanceof HTMLElement) || sibling.inert) continue;
			sibling.inert = true;
			marked.push(sibling);
		}
		child = child.parentElement;
	}
	return () => {
		for (const element of marked) element.inert = false;
	};
}
