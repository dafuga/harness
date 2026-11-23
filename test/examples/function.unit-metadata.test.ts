import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { configValues } from '../../src/services/explorer-ui/revision-detail-service/configValues';
import { declarationRole } from '../../src/services/explorer-ui/revision-detail-service/declarationRole';
import { modelDefinitions } from '../../src/services/explorer-ui/revision-detail-service/modelDefinitions';

const unitId = 'function.unit-metadata';
const modelSource = 'src/services/explorer-ui/revision-detail-service/configValues.types.ts';
const modelText = `export interface ConfigSource {
	file: ts.SourceFile;
	source: string;
	bindings: Map<string, ts.Expression>;
}
export type Bindings = Map<string, ts.Expression>;
interface Hidden { value: number; }
`;
const configSource = 'src/configs/development-tooling/reports.ts';
const configText =
	'export const reportLimits = { pageSize: 50, retries: 3 };\nconst hiddenLimit = 1;';
const jsonSource = 'src/configs/development-tooling/moduleGroups.json';
const jsonText = '{ "name": "reports", "enabled": true }';

const roleInputs = [
	{ kind: 'class', stored: true },
	{ kind: 'class', stored: false },
	{ kind: 'interface', stored: false },
	{ kind: 'const', stored: false }
];

function configSummary(text: string, source: string) {
	return configValues(text, source).map((variable) => ({
		name: variable.name,
		source: variable.source
	}));
}

test('Declaration roles follow kind and stored flag', () => {
	const cases = roleInputs.map(({ kind, stored }) => ({
		name: `${kind} with stored=${stored}`,
		input: { kind, stored },
		output: declarationRole(kind, stored)
	}));
	expect(cases.map((item) => item.output)).toEqual([
		'persisted-model',
		'runtime-support',
		'type',
		'runtime-support'
	]);
	recordExampleCases(
		{
			unitId,
			symbol: 'declarationRole',
			state: 'declaration-roles-follow-kind-and-stored-flag',
			evidence: 'examples-cases',
			file: 'declaration-roles-follow-kind-and-stored-flag.json'
		},
		cases
	);
});

test('Model definitions come from exported declarations', () => {
	const names = modelDefinitions(modelText, modelSource).map((definition) => definition.name);
	expect(names).toEqual(['ConfigSource', 'Bindings']);
	recordExampleCases(
		{
			unitId,
			symbol: 'modelDefinitions',
			state: 'model-definitions-come-from-exported-declarations',
			evidence: 'examples-cases',
			file: 'model-definitions-come-from-exported-declarations.json'
		},
		[
			{
				name: 'exported interface and type alias are modelled',
				input: { source: modelSource },
				output: names
			}
		]
	);
});

test('Config values name exported constants and JSON defaults', () => {
	const constants = configSummary(configText, configSource);
	const jsonDefault = configSummary(jsonText, jsonSource);
	expect(constants).toEqual([
		{ name: 'reportLimits.pageSize', source: configSource },
		{ name: 'reportLimits.retries', source: configSource }
	]);
	expect(jsonDefault).toEqual([
		{ name: 'moduleGroups.name', source: jsonSource },
		{ name: 'moduleGroups.enabled', source: jsonSource }
	]);
	recordExampleCases(
		{
			unitId,
			symbol: 'configValues',
			state: 'config-values-name-exported-constants-and-json-defaults',
			evidence: 'examples-cases',
			file: 'config-values-name-exported-constants-and-json-defaults.json'
		},
		[
			{
				name: 'exported constant keeps its name and source',
				input: { source: configSource },
				output: constants
			},
			{
				name: 'JSON document is named after its file',
				input: { source: jsonSource },
				output: jsonDefault
			}
		]
	);
});
