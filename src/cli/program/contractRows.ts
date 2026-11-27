// @harness-uid u_m3b6bsf3br
import type { ComponentManifest } from '../../core/development-tooling/unitTypes';
import type { Field } from './renderUnit.types';

export const indent = (lines: string[], depth = 1) =>
	lines.map((line) => `${'  '.repeat(depth)}${line}`);

function qualifiers(item: Field): string {
	const values: string[] = [];
	if (item.required !== undefined) values.push(item.required ? 'required' : 'optional');
	if (item.defaultKind === 'omitted') values.push('no default');
	if (item.defaultKind === 'undefined') values.push('default undefined');
	if (Object.hasOwn(item, 'default')) values.push(`default ${JSON.stringify(item.default)}`);
	return values.length ? `  (${values.join('; ')})` : '';
}

/** Component props always use plain names; operation inputs retain ambiguous callable owners. */
export function fields(list: Field[], componentProps = false): string[] {
	if (list.length === 0) return ['none'];
	if (componentProps)
		list = [...new Map(list.map((item) => [item.name.split('.').at(-1), item])).values()];
	const names = list.map((item) => item.name.split('.').at(-1) ?? item.name);
	const repeated = new Set(names.filter((name, index) => names.indexOf(name) !== index));
	const rows = list.map(
		(item, index) =>
			[
				!componentProps && repeated.has(names[index]) ? item.name : names[index],
				`${item.type}${qualifiers(item)}`
			] as const
	);
	const width = Math.max(...rows.map(([name]) => name.length));
	return rows.flatMap(([name, type], index) => [
		type === 'thrown' ? name : `${name.padEnd(width)}  ${type}`,
		...(list[index].description?.split(/\r?\n/).map((line) => `  ${line}`) ?? [])
	]);
}

export function errorRows(
	errors: Field[],
	status: ComponentManifest['contract']['errorStatus']
): string[] {
	if (errors.length)
		return [...fields(errors), ...(status === 'unknown' ? ['Other indirect errors unknown.'] : [])];
	if (status === 'declared') return ['none (declared)'];
	if (status === 'unknown') return ['unknown (indirect calls or dynamic throws)'];
	return ['none found (static analysis; indirect errors unknown)'];
}

export function operationRows(
	operations: NonNullable<ComponentManifest['contract']['operations']>
): string[] {
	return operations.flatMap((operation) => [
		operation.name,
		...indent([
			'Inputs',
			...indent(fields(operation.inputs)),
			'Outputs',
			...indent(fields(operation.outputs)),
			'Errors',
			...indent(errorRows(operation.errors, operation.errorStatus))
		])
	]);
}

export function storageRows(
	models: NonNullable<ComponentManifest['contract']['storage']>
): string[] {
	return models.flatMap((model) => [
		model.name,
		...indent([
			`Table  ${model.table ?? 'unknown'}`,
			`Primary key  ${model.primaryKey ?? 'unknown'}`,
			...model.fields.map(
				(field) =>
					`${field.name}  ${field.type}${qualifiers(field)}${field.primaryKey ? '  (primary key)' : ''}${field.nullable ? '  (nullable)' : ''}${field.validation ? `  validation: ${field.validation}` : ''}${field.relations ? `  relations: ${field.relations}` : ''}`
			),
			...(model.validation ? [`Validation  ${model.validation}`] : []),
			...(model.relations ? [`Relations  ${model.relations}`] : []),
			...(model.unresolved ?? []).map((gap) => `Unresolved  ${gap}`)
		])
	]);
}
