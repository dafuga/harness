import type { HarnessUnit } from '../../../../src/models/explorer-ui/Harness.types';
import { modelDefinition, typeDeclarations } from '../../../../test/entityClassFixtures';
import { ids, units } from '../../../../test/entityUnits';
import type { PreviewCases } from './shared';

const sampleOrders = [{ id: 'A-1048', status: 'Ready to ship' }];
const fields = {
	inputs: [
		{ name: 'OrderList.orders', type: 'Order[]', required: true, examples: [sampleOrders] },
		{
			name: 'OrderList.searchText',
			type: 'string',
			required: false,
			default: '',
			examples: ['A-1048']
		}
	],
	outputs: [{ name: 'OrderList', type: 'markup' }],
	errors: []
};

/** A populated component contract uses actual-shaped orders instead of a string list. */
export function contractPreviewUnit(unit: HarnessUnit): HarnessUnit {
	return { ...unit, contract: fields };
}

function callableUnit(error = false): HarnessUnit {
	const seed = units.find((unit) => unit.id === ids.filter)!;
	const inputs = [
		{ name: 'filterOrders.orders', type: 'Order[]', required: true, examples: [sampleOrders] },
		{
			name: 'filterOrders.searchText',
			type: 'string',
			required: false,
			default: '',
			examples: ['A-1048']
		}
	];
	return {
		...seed,
		helpers: [{ name: 'filterOrders', source: seed.owns.source[0], inputs, output: 'Order[]' }],
		contract: {
			inputs,
			outputs: [{ name: 'filterOrders', type: 'Order[]', examples: [sampleOrders] }],
			errors: error
				? [
						{
							name: 'filterOrders.invalidOrders',
							type: 'TypeError',
							examples: ['Orders must be an array']
						}
					]
				: []
		}
	};
}

function serviceUnit(): HarnessUnit {
	const seed = units.find((unit) => unit.id === ids.store)!;
	return {
		...seed,
		owns: { ...seed.owns, symbols: ['OrderStore', 'OrderStore.read', 'OrderStore.write'] },
		contract: {
			inputs: [
				{
					name: 'OrderStore.read.accountId',
					type: 'string',
					required: true,
					examples: ['account-42']
				},
				{
					name: 'OrderStore.write.orders',
					type: 'Order[]',
					required: true,
					examples: [sampleOrders]
				}
			],
			outputs: [
				{ name: 'OrderStore.read', type: 'Promise<Order[]>', examples: [sampleOrders] },
				{ name: 'OrderStore.write', type: 'Promise<void>' }
			],
			errors: [{ name: 'OrderStore.read.notFound', type: 'NotFoundError' }]
		}
	};
}

function modelUnit(seed: HarnessUnit, bare: boolean): HarnessUnit {
	const source = 'src/models/Order.ts';
	const definition = modelDefinition('Order', source);
	return {
		...seed,
		id: 'app.model.order',
		kind: 'model',
		title: 'Order',
		owns: { source: [source], symbols: ['Order'] },
		modelDefinitions: [
			{
				...definition,
				fields: bare
					? []
					: [...definition.fields, { name: 'status', type: 'string', optional: false }],
				methods: bare
					? []
					: [
							{
								name: 'find',
								inputs: [{ name: 'id', type: 'string' }],
								output: 'Promise<Order | undefined>'
							}
						]
			}
		],
		contract: {
			inputs: bare ? [] : [{ name: 'Order.find.id', type: 'string', required: true }],
			outputs: [],
			errors: []
		}
	};
}

/** Render the same contract component for its distinct source and interaction states. */
export function entityContractVariant(props: PreviewCases[string], variant: string) {
	const unit = props.unit as HarnessUnit;
	if (variant === 'empty')
		return { ...props, unit: { ...unit, contract: { inputs: [], outputs: [], errors: [] } } };
	if (variant === 'errors')
		return {
			...props,
			unit: {
				...unit,
				contract: {
					...unit.contract,
					errors: [
						{
							name: 'OrderList.invalidOrders',
							type: 'TypeError',
							examples: ['Orders must be an array']
						}
					]
				}
			}
		};
	if (variant === 'last') return { ...props, last: '7561ee42571f249925f71feb0bddcbdc45da9bbe' };
	if (variant === 'example-open') return props;
	if (variant === 'function' || variant === 'function-error')
		return {
			...props,
			unit: callableUnit(variant === 'function-error'),
			category: 'functions',
			contract: []
		};
	if (variant === 'service')
		return { ...props, unit: serviceUnit(), category: 'services', contract: [] };
	if (variant === 'model' || variant === 'model-bare')
		return {
			...props,
			unit: modelUnit(unit, variant === 'model-bare'),
			category: 'models',
			contract: []
		};
	return declarationVariant(props, unit, variant);
}

function declarationVariant(props: PreviewCases[string], unit: HarnessUnit, variant: string) {
	if (variant === 'types') {
		const source = 'src/models/OrderInput.types.ts';
		return {
			...props,
			unit: {
				...unit,
				title: 'OrderInput',
				owns: { source: [source], symbols: ['OrderInput'] },
				modelDefinitions: typeDeclarations(source),
				contract: {
					...unit.contract,
					inputs: [{ name: 'OrderInput.resolve', type: '(key: string): number', required: true }]
				}
			},
			category: 'types',
			contract: []
		};
	}
	if (variant === 'config') {
		const config = units.find((item) => item.id === ids.settings)!;
		return {
			...props,
			unit: {
				...config,
				contract: {
					inputs: [],
					outputs: [{ name: 'orderSettings.pageSize', type: 'number', examples: [25] }],
					errors: []
				}
			},
			category: 'configs',
			contract: []
		};
	}
	return null;
}
