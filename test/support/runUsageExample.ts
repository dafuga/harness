import { resolve } from 'node:path';
import { types } from 'node:util';
import { runInNewContext } from 'node:vm';
import { pathToFileURL } from 'node:url';
import type {
	UnitDocumentation,
	UsageExample
} from '../../src/utils/unit-documentation/unitDocumentation';
import { expect } from '../verificationExpect';
import type { DeclaredHelperExamples, ObservedUsageExample } from './unitExamples.types';

function thrownValue(error: unknown): unknown {
	return types.isNativeError(error) ? error.message : error;
}

export async function runUsageExample(
	example: UsageExample,
	scope: Record<string, unknown>,
	setup?: string
): Promise<ObservedUsageExample> {
	if (!example.call?.trim()) throw new Error(`Usage example "${example.name}" has no call.`);
	const code = setup ? `${setup}\n${example.call}` : example.call;
	let output: unknown;
	let thrown: unknown;
	let didThrow = false;
	try {
		output = await runInNewContext(code, { ...scope });
	} catch (error) {
		didThrow = true;
		thrown = error;
	}
	if (Object.hasOwn(example, 'error')) {
		expect(didThrow).toEqual(true);
		const error = didThrow ? thrownValue(thrown) : undefined;
		expect(error).toEqual(example.error);
		return { name: example.name, input: example.input, error };
	}
	if (didThrow) throw thrown;
	expect(output).toEqual(example.output);
	return { name: example.name, input: example.input, output };
}

export async function runHelperExamples(
	helper: DeclaredHelperExamples,
	root: string
): Promise<ObservedUsageExample[]> {
	const exports = await import(pathToFileURL(resolve(root, helper.source)).href);
	const scope = { ...exports };
	return Promise.all(helper.examples.map((example) => runUsageExample(example, scope)));
}

export function runDocumentedExamples(
	doc: UnitDocumentation,
	scope: Record<string, unknown>
): Promise<ObservedUsageExample[]> {
	return Promise.all(doc.examples.map((example) => runUsageExample(example, scope, doc.setup)));
}
