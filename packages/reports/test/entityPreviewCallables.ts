import type { HarnessUnit } from '../src/models/Harness.types';
import { ids } from './entityUnits';

export function callableFixture(unit: HarnessUnit): HarnessUnit {
	const returnNames: Record<string, string> = {
		toKebabCase: 'kebabCaseText',
		countWords: 'wordCount',
		reset: 'noReturnValue'
	};
	const exampleReturns: Record<string, string | number | null> = {
		toKebabCase: 'hello-world',
		countWords: 2,
		reset: null
	};
	const helpers = [
		['toKebabCase', 'string'],
		['countWords', 'number'],
		['reset', 'void']
	].map(([name, output]) => ({
		name,
		output,
		source: 'src/functions/text.ts',
		pure: true,
		consumers: [{ unit: ids.list }, { unit: ids.store }],
		examples: [
			{
				name: `${name} usage`,
				call: name === 'reset' ? 'reset() ?? null' : `${name}("hello world")`,
				input: name === 'reset' ? [] : ['hello world'],
				output: exampleReturns[name]
			}
		],
		inputs: name === 'reset' ? [] : [{ name: `${name}.textToConvert`, type: 'string' }]
	}));
	return {
		...unit,
		helpers,
		owns: { source: ['src/functions/text.ts'], symbols: helpers.map((h) => h.name) },
		contract: {
			inputs: helpers.flatMap((h) => h.inputs.map((i) => ({ ...i, examples: ['hello world'] }))),
			outputs: helpers.map((h) => ({
				name: `${h.name}.${returnNames[h.name]}`,
				type: h.output,
				...(h.output === 'void' ? {} : { examples: [h.name === 'countWords' ? 2 : 'hello-world'] })
			})),
			errors: [
				{
					name: 'countWords.invalidInput',
					type: 'TypeError',
					examples: [{ name: 'TypeError', message: 'Input text required.' }]
				}
			]
		}
	};
}
