/** Additional representative states stay beside each component's required default state. */
const variants: Record<string, string[]> = {
	'reports.component.module-system-explorer-module-resources-screen': ['playwright'],
	'reports.component.module-system-explorer-modules-screen': ['playwright', 'headless-audio']
};
export const previewVariants = (id: string): string[] => ['', ...(variants[id] ?? [])];
export const previewState = (id: string, variant = ''): string =>
	id.replaceAll('.', '-') + (variant ? `-${variant}` : '');
