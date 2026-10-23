import type { PreviewCases } from './shared';
import { noop, text } from './shared';
import * as d from './explorerData';
const sourceFiles = ['src/components/OrderList.svelte', 'src/utils/filterOrders.ts'];
const sourceText = (path: string) =>
	`// Synthetic preview source of ${path}; no project file is read.\nexport const preview = true;\n`;
const source = {
	files: async () => sourceFiles,
	read: async (path: string) => sourceText(path),
	commit: d.commits.middle
};
export const sourceCases: PreviewCases = {
	'reports.component.source-code-action': {
		entity: d.entity,
		nav: { ...d.navigation, source: noop },
		path: sourceFiles[0]
	},
	'reports.component.source-content': source,
	'reports.component.source-dialog': { ...source, open: true, title: 'OrderList', onClose: noop },
	'reports.component.source-file-list': {
		files: sourceFiles,
		href: () => undefined,
		children: text('<span>Synthetic file action</span>')
	},
	'reports.component.source-viewer': {
		state: {
			files: sourceFiles,
			path: sourceFiles[0],
			text: sourceText(sourceFiles[0]),
			loading: false,
			error: ''
		},
		commit: d.commits.middle,
		onSelect: noop
	}
};
