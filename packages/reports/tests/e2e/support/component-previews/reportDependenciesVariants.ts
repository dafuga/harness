import type { ExplorerScreenProps } from '../../../../src/models/explorer-ui/ExplorerScreen.types';
import type { PreviewCases } from './shared';
import { dependencyData } from './dependencies';

/** A selected revision can have no index, empty manifests or explicitly incomplete data. */
export function dependenciesVariant(props: PreviewCases[string], variant: string) {
	const host = props as unknown as ExplorerScreenProps;
	const gaps = ['packages/legacy/package.json could not be read at this revision.'];
	let record = dependencyData;
	if (variant === 'unindexed')
		return { ...props, head: { ...host.head, projectDependencies: undefined } };
	if (variant === 'empty') record = { entries: [], gaps: [] };
	if (variant === 'partial') record = { ...record, gaps };
	if (variant === 'unreadable') record = { entries: [], gaps };
	return { ...props, head: { ...host.head, projectDependencies: record } };
}
