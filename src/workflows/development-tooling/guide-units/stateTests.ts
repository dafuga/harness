// @harness-uid u_ot7pacqchb
import { posix } from 'node:path';
import ts from 'typescript';
import type {
	ComponentManifest,
	ScenarioManifest
} from '../../../core/development-tooling/unitTypes';
import type { GuidanceContext, StateTest } from './guideUnits.types';
import { guidanceText } from './guidanceContext';
import { unitStateName } from './contractStates';
import { testAttribution } from '../../../cli/program/testAttribution';
import { graphOf } from '../load-units/loadUnits';

function declaredState(scenario: ScenarioManifest, unit: string, state: string) {
	const specific = scenario.states.some((item) => item.units?.includes(unit));
	return scenario.states.some(
		(item) =>
			item.coverage === 'required' &&
			(!specific || item.units?.includes(unit)) &&
			unitStateName(unit, item.id) === state
	);
}

/** Declaration plus authored test syntax: a string in a fixture alone cannot satisfy coverage. */
export async function stateTests(
	context: GuidanceContext,
	unit: ComponentManifest,
	state: string
): Promise<StateTest[]> {
	const paths = declaredTestPaths(context, unit, state);
	for (const file of attributedTests(context, unit))
		if (!paths.has(file)) paths.set(file, new Set());
	const found: StateTest[] = [];
	for (const [file, viewports] of paths) {
		if (!context.loaded.index.files.has(file)) continue;
		if (!context.testSyntax.has(file))
			context.testSyntax.set(file, authoredTest(await guidanceText(context, file)));
		const syntax = context.testSyntax.get(file)!;
		if (syntax.test && (syntax.states.has(state) || (viewports.size > 0 && syntax.matrix)))
			found.push({ file, viewports: [...viewports] });
	}
	return found;
}

function declaredTestPaths(context: GuidanceContext, unit: ComponentManifest, state: string) {
	const paths = new Map<string, Set<string>>();
	for (const scenario of context.loaded.scenarios.filter(
		(item) => item.units.includes(unit.id) && declaredState(item, unit.id, state)
	)) {
		for (const test of scenario.tests) {
			for (const path of scenarioTestFiles(context, test))
				paths.set(
					path,
					new Set([
						...(paths.get(path) ?? []),
						...scenario.viewports.map((viewport) => viewport.id)
					])
				);
		}
	}
	return paths;
}

/** Resolve literal test arguments, including catalog commands, without executing the runner. */
function scenarioTestFiles(
	context: GuidanceContext,
	test: ScenarioManifest['tests'][number]
): string[] {
	if (test.runner !== 'command') return [posix.normalize(posix.join(test.cwd ?? '.', test.target))];
	if (!/\b(?:playwright|vitest)\s+(?:test|run)\b/.test(test.target)) return [];
	const names = [
		...test.target.matchAll(/(?:^|[\s"'])([\w./@-]+\.(?:spec|test)\.[cm]?[tj]sx?)(?=$|[\s"'])/g)
	].map((match) => match[1]);
	return names.flatMap((name) => scopedTestFile(context, test.cwd ?? '.', name));
}

function scopedTestFile(context: GuidanceContext, cwd: string, name: string): string[] {
	const exact = posix.normalize(posix.join(cwd, name));
	if (context.loaded.index.files.get(exact)?.classification === 'test') return [exact];
	const directory = posix.normalize(cwd);
	const prefix = directory === '.' ? '' : `${directory}/`;
	const candidates = [...context.loaded.index.files.values()].filter(
		(file) =>
			file.classification === 'test' &&
			file.path.startsWith(prefix) &&
			posix.basename(file.path) === name
	);
	return candidates.length === 1 ? [candidates[0].path] : [];
}

function attributedTests(context: GuidanceContext, unit: ComponentManifest): string[] {
	context.graph ??= graphOf(context.loaded);
	if (!context.testAttributions.has(unit.id))
		context.testAttributions.set(
			unit.id,
			testAttribution(context.graph, unit, context.loaded.scenarios)
		);
	const attribution = context.testAttributions.get(unit.id)!;
	return [...attribution.directImports, ...attribution.transitiveImpacts].map((test) => test.file);
}

function authoredTest(text: string) {
	const source = ts.createSourceFile('test.ts', text, ts.ScriptTarget.Latest, true);
	const found = { test: false, states: new Set<string>(), matrix: false };
	const visit = (node: ts.Node) => {
		if (ts.isCallExpression(node)) {
			const called = node.expression.getText(source);
			if (/^(?:test|it)(?:\.describe)?\.(?:skip|todo)\b/.test(called)) return;
			if (/^(?:test|it)(?:\.(?:each|only))?$/.test(called)) found.test = true;
		}
		if (ts.isStringLiteralLike(node)) found.states.add(node.text);
		if (
			ts.isIdentifier(node) &&
			/^(?:catalogCases|previewVariants|variants|previewState|state)$/.test(node.text)
		)
			found.matrix = true;
		ts.forEachChild(node, visit);
	};
	visit(source);
	return found;
}
