// @harness-uid u_bfad3bg4oz
import type { ComponentManifest } from '../../../core/development-tooling/unitTypes';
import type { GuidanceContext, UnitState } from './guideUnits.types';
import { mergeUnitStates } from './contractStates';

export async function guidanceText(context: GuidanceContext, path: string): Promise<string> {
	if (!context.texts.has(path)) context.texts.set(path, await context.tree.read(path));
	return context.texts.get(path)!;
}

/** Source branch literals are hints: importing a dependency never establishes rendered proof. */
export async function sourceUnitStates(
	context: GuidanceContext,
	unit: ComponentManifest
): Promise<UnitState[]> {
	const states: UnitState[] = [];
	for (const path of sourceStatePaths(context, unit)) {
		const source = await guidanceText(context, path);
		states.push(...sourceBranchStates(source, path));
	}
	return mergeUnitStates([states]);
}

function sourceStatePaths(context: GuidanceContext, unit: ComponentManifest): Set<string> {
	const paths = new Set(unit.owns.source);
	for (const path of unit.owns.source)
		for (const dependency of stateReferences(context, path, /(?:[Nn]otice\.ts|Progress\.svelte)$/))
			paths.add(dependency);
	for (const path of [...paths].filter((path) => !unit.owns.source.includes(path)))
		for (const dependency of stateReferences(context, path, /\.types\.ts$/)) paths.add(dependency);
	return paths;
}

function stateReferences(context: GuidanceContext, path: string, pattern: RegExp): string[] {
	return (context.loaded.index.files.get(path)?.references ?? []).flatMap((reference) =>
		reference.path && pattern.test(reference.path) ? [reference.path] : []
	);
}

function sourceBranchStates(source: string, path: string): UnitState[] {
	const states: UnitState[] = [];
	const matches = source.matchAll(
		/\b(?:status|state|phase|mode|variant)\s*(?:===?|!==?)\s*['"]([\w-]+)['"]|\b(?:status|state|phase|mode)\??\s*:\s*((?:['"][\w-]+['"]\s*\|?\s*)+)|\b\w*(?:Status|State|Phase|Mode)\s*=\s*((?:['"][\w-]+['"]\s*\|?\s*)+)/g
	);
	for (const match of matches) {
		const names = match[1]
			? [match[1]]
			: [...(match[2] ?? match[3]).matchAll(/['"]([\w-]+)['"]/g)].map((item) => item[1]);
		for (const name of names)
			states.push({ name, origin: 'GUESS', reasons: [`Source branch/type in ${path}.`] });
		if (names.includes('complete'))
			states.push({
				name: 'succeeded',
				origin: 'GUESS',
				reasons: [`Successful complete branch in ${path}.`]
			});
	}
	return states;
}
