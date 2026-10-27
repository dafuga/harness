/** Additional representative states stay beside each component's required default state. */
const variants: Record<string, string[]> = {
	'reports.component.module-system-explorer-module-resources-screen': ['playwright'],
	'reports.component.module-system-explorer-modules-screen': ['playwright', 'headless-audio'],
	'desktop.component.project-agent': [
		'closed',
		'read-only',
		'local-comment',
		'hosted-comment',
		'comment-retry',
		'conversation',
		'historical',
		'ask',
		'plan',
		'visual-plan',
		'change',
		'no-provider',
		'running',
		'saved-plan',
		'failure',
		'agents-empty',
		'agents-active',
		'agents-unknown',
		'agents-stale',
		'agents-many'
	]
};
export const previewVariants = (id: string): string[] => ['', ...(variants[id] ?? [])];
export const previewState = (id: string, variant = ''): string =>
	id.replaceAll('.', '-') + (variant ? `-${variant}` : '');
