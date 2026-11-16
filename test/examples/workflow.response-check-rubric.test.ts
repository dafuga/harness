import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import {
	responseRubricVersion,
	responseCheckDefinitions,
	responseCheckQuestions
} from '../../src/workflows/verification-evidence/responseCheckRubric';
import type { ResponseCheckDefinition } from '../../src/workflows/verification-evidence/responseCheckRubric.types';

const standardIds = ['fulfillment', 'completeness', 'constraints', 'relevance'];
const customCriteria = [
	{ id: 'cites-sources', description: 'Every factual claim names the source it relies on.' }
];
const singleDefinition: ResponseCheckDefinition[] = [
	{ id: 'fulfillment', title: 'Task', question: 'Does it answer?', guidance: 'Answer it.' }
];

test('Exposes the fixed rubric version', () => {
	expect(responseRubricVersion).toBe('response-check-v1');
	recordExampleCases(
		{
			unitId: 'workflow.response-check-rubric',
			symbol: 'responseRubricVersion',
			state: 'exposes-the-fixed-rubric-version',
			evidence: 'examples-cases',
			file: 'exposes-the-fixed-rubric-version.json'
		},
		[{ name: 'fixed version constant', input: {}, output: responseRubricVersion }]
	);
});

test('Builds rubric checks from standard and custom criteria', () => {
	const standardOnly = responseCheckDefinitions([]);
	const withCustom = responseCheckDefinitions(customCriteria);
	const standardOnlyIds = standardOnly.map((item) => item.id);
	const withCustomIds = withCustom.map((item) => item.id);

	expect(standardOnlyIds).toEqual(standardIds);
	expect(withCustomIds).toEqual([...standardIds, 'custom:cites-sources']);
	expect(withCustom[4]).toEqual({
		id: 'custom:cites-sources',
		title: 'Acceptance criterion: cites-sources',
		question:
			'Does the answer satisfy this acceptance criterion? "Every factual claim names the source it relies on."',
		guidance: 'Revise the answer to satisfy acceptance criterion cites-sources.'
	});
	recordExampleCases(
		{
			unitId: 'workflow.response-check-rubric',
			symbol: 'responseCheckDefinitions',
			state: 'builds-rubric-checks-from-standard-and-custom-criteria',
			evidence: 'examples-cases',
			file: 'builds-rubric-checks-from-standard-and-custom-criteria.json'
		},
		[
			{
				name: 'empty criteria yield only the four standard checks',
				input: { criteria: [] },
				output: { ids: standardOnlyIds }
			},
			{
				name: 'one criterion appends a custom check after the standard checks',
				input: { criteria: customCriteria },
				output: { ids: withCustomIds, custom: withCustom[4] }
			}
		]
	);
});

test('Builds choice questions keyed by definition id', () => {
	const questions = responseCheckQuestions(responseCheckDefinitions(customCriteria));
	const single = responseCheckQuestions(singleDefinition);

	expect(Object.keys(questions)).toEqual([...standardIds, 'custom:cites-sources']);
	expect(questions.constraints).toMatchObject({
		type: 'choice',
		criteria: {
			meets:
				'The answer follows all explicit constraints; if none are specified, this check is satisfied.'
		}
	});
	expect(questions.fulfillment).toMatchObject({
		type: 'choice',
		criteria: {
			meets:
				'The supplied answer satisfies this check, including caller-defined acceptance criteria.'
		}
	});
	expect(questions.fulfillment.instructions).toContain(
		'Does the answer perform the task requested by the user?'
	);
	expect(Object.keys(single)).toEqual(['fulfillment']);
	expect(single.fulfillment.instructions).toContain('Does it answer?');
	recordExampleCases(
		{
			unitId: 'workflow.response-check-rubric',
			symbol: 'responseCheckQuestions',
			state: 'builds-choice-questions-keyed-by-definition-id',
			evidence: 'examples-cases',
			file: 'builds-choice-questions-keyed-by-definition-id.json'
		},
		[
			{
				name: 'standard and custom definitions produce one choice question per id',
				input: { definitions: responseCheckDefinitions(customCriteria).map((item) => item.id) },
				output: {
					ids: Object.keys(questions),
					constraintsMeets: questions.constraints.criteria.meets,
					fulfillmentMeets: questions.fulfillment.criteria.meets
				}
			},
			{
				name: 'only id and question of a single definition are read',
				input: { definitions: singleDefinition },
				output: { ids: Object.keys(single), instructions: single.fulfillment.instructions }
			}
		]
	);
});
