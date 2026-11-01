import type { ComponentManifest } from '../../core/development-tooling/unitTypes';
import type { Field } from './renderUnit.types';
import { errorRows, fields, indent, operationRows, storageRows } from './contractRows';

/** Render source operation groups while retaining readable historical array-only contracts. */
export function renderContract(manifest: ComponentManifest): string[] {
	const { contract, kind } = manifest;
	const component = kind === 'component';
	const detailed = component ? [] : detailSections(contract);
	if (detailed.length)
		return [`Contract (${contract.origin})`, ...primitiveRows(contract), ...detailed];
	const sections: Array<[string, Field[]]> = [[component ? 'Props' : 'Inputs', contract.inputs]];
	if (!component) sections.push(['Outputs', contract.outputs]);
	sections.push(['Errors', contract.errors]);
	return [
		`Contract (${contract.origin})`,
		...primitiveRows(contract),
		...indent(
			sections.flatMap(([title, list]) => [title, ...indent(sectionFields(title, list, manifest))])
		),
		...group('Snippets (local)', contract.snippets, operationRows),
		...(component ? group('Module exports', contract.operations, operationRows) : [])
	];
}

function sectionFields(title: string, list: Field[], manifest: ComponentManifest): string[] {
	if (title === 'Errors' && !list.length && manifest.contract.origin === 'derived')
		return errorRows(list, manifest.contract.errorStatus);
	return fields(list, manifest.kind === 'component' && title === 'Props');
}

function detailSections(contract: ComponentManifest['contract']): string[] {
	return [
		...group('Storage', contract.storage, storageRows),
		...group('Initialization', contract.initialization, operationRows),
		...group('Operations', contract.operations, operationRows)
	];
}

function group<T>(
	title: string,
	items: T[] | undefined,
	render: (items: T[]) => string[]
): string[] {
	return items?.length ? [`  ${title}`, ...indent(render(items), 2)] : [];
}

function primitiveRows(contract: ComponentManifest['contract']): string[] {
	return contract.primitives?.length
		? ['  Shared primitives', ...contract.primitives.map((id) => `    ${id}`)]
		: [];
}
