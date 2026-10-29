import type { PreviewCases } from './shared';
import { noop, text } from './shared';
import * as d from './explorerData';
const sourceFiles = ['src/components/OrderList.svelte', 'src/utils/filterOrders.ts'];
const sourceText = (path: string) =>
	path.endsWith('.svelte')
		? '<script lang="ts">\n  let orders = $state([]);\n</script>\n\n<h2>Recent orders</h2>\n'
		: "export const isReady = (order) =>\n  order.status === 'ready';\n";
const source = {
	files: async () => sourceFiles,
	read: async (path: string) => sourceText(path),
	commit: 'b8e942614a5729731db6225e9c1297f031de8a40'
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
		children: text('<button type="button" class="hx-action plain">View code</button>')
	},
	'reports.component.source-viewer': {
		state: {
			files: sourceFiles,
			path: sourceFiles[0],
			text: sourceText(sourceFiles[0]),
			loading: false,
			error: ''
		},
		commit: source.commit,
		onSelect: noop
	}
};
