import type { ComponentManifest } from '../../../src/core/unitTypes';
import { expect } from '../../verificationExpect';
import type { Indexed } from '../../support/memoryTree';
import { indexFiles, unitOf } from '../../support/memoryTree';
import { measureWorkload } from '../../support/measureWorkload';

/** Operation-specific explanations survive even when storage fields replace top-level inputs. */
export async function assertContractDocumentation(
	files: Record<string, string>,
	indexed: Indexed
): Promise<void> {
	const declared = indexed.result.manifests.map(documented);
	const again = await measureWorkload(
		'function.derive-manifest',
		'retain-authored-method-and-constructor-contracts',
		() => indexFiles(files, declared)
	);
	const call = unitOf(again, 'function.call');
	expect(call.contract.inputs.find((field) => field.name === 'call.flag')).toEqual({
		name: 'call.flag',
		type: 'boolean',
		required: false,
		default: false,
		description: 'Shared input explanation.'
	});
	const model = unitOf(again, 'model.entry');
	expect(unitOf(again, 'function.call').contract.operations?.[0].inputs[0].description).toBe(
		'Shared input explanation.'
	);
	expect(model.contract.inputs.map((field) => field.name)).not.toContain('Entry.find.adapter');
	expect(model.contract.operations?.[0]).toMatchObject({
		inputs: [
			{ name: 'Entry.find.adapter', required: true, description: 'Input to Entry.find.' },
			{ name: 'Entry.find.id', required: true, description: 'Input to Entry.find.' }
		],
		outputs: [{ name: 'Entry.find', description: 'Result of Entry.find.' }]
	});
	expect(unitOf(again, 'service.store').contract.initialization?.[0].inputs).toEqual([
		{
			name: 'StoreService.constructor.root',
			type: 'string',
			required: false,
			default: '/tmp',
			description: 'Root used by the store.'
		}
	]);
	expect(unitOf(again, 'component.panel').contract.inputs).toContainEqual(
		expect.objectContaining({ name: 'Panel.children', defaultKind: 'omitted' })
	);
	expect((await indexFiles(files, again.result.manifests)).result.updated).toEqual([]);
}

function documented(unit: ComponentManifest): ComponentManifest {
	return {
		...unit,
		contract: {
			...unit.contract,
			origin: 'declared' as const,
			inputs: unit.contract.inputs.map((field) => ({
				...field,
				...(field.name === 'call.flag' ? { default: false, defaultKind: undefined } : {}),
				description: 'Shared input explanation.'
			})),
			operations: unit.contract.operations?.map((operation) => ({
				...operation,
				inputs: operation.inputs.map((field) => ({
					...field,
					...(field.name === 'call.name' ? {} : { description: `Input to ${operation.name}.` })
				})),
				outputs: operation.outputs.map((field) => ({
					...field,
					description: `Result of ${operation.name}.`
				}))
			})),
			initialization: unit.contract.initialization?.map((operation) => ({
				...operation,
				inputs: operation.inputs.map((field) => ({
					...field,
					required: true,
					default: '/wrong',
					description: 'Root used by the store.'
				}))
			}))
		}
	};
}
