/**
 * On a phone the categories are one row that scrolls sideways. Keep the active category in view as
 * the page opens and as the category changes. Only the row moves, never the page.
 */
export function keepActiveInRow(row: HTMLElement) {
	const reveal = () => {
		const active = row.querySelector<HTMLElement>('a.active');
		if (!active || row.scrollWidth <= row.clientWidth) return;
		const offset = active.getBoundingClientRect().left - row.getBoundingClientRect().left;
		const target = row.scrollLeft + offset - (row.clientWidth - active.offsetWidth) / 2;
		row.scrollLeft = Math.max(0, Math.min(target, row.scrollWidth - row.clientWidth));
	};
	reveal();
	const watch = new MutationObserver(reveal);
	watch.observe(row, { attributes: true, attributeFilter: ['class'], subtree: true });
	return { destroy: () => watch.disconnect() };
}
