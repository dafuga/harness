import type { Declared } from './entityServiceContract.types';
import type { HarnessRevision, HarnessUnit } from '../src/models/Harness.types';
import { serviceClassProof, serviceMetadata } from './entityClassFixtures';
import { ids, units } from './entityUnits';

/** AgentActivityService as specification/units/service.agent-activity.json declares it now. */
export const agentActivity: Declared = {
	id: 'service.agent-activity',
	title: 'AgentActivityService',
	responsibility:
		'Registers agents, records their heartbeats and ends, and lists the agents of a repository with whether each is working now.',
	source: 'src/services/agents-providers/agent-activity-service/AgentActivityService.ts',
	className: 'AgentActivityService',
	methods: ['register', 'heartbeat', 'finish', 'roster'],
	symbols: [
		'AgentActivityService',
		'AgentActivityService.constructor',
		'AgentActivityService.register',
		'AgentActivityService.heartbeat',
		'AgentActivityService.finish',
		'AgentActivityService.roster'
	],
	contract: {
		inputs: [
			{ name: 'AgentActivityService.constructor.root', type: 'string' },
			{ name: 'AgentActivityService.constructor.checkouts', type: 'Checkout[]' },
			{ name: 'AgentActivityService.register.input', type: 'AgentInput' },
			{ name: 'AgentActivityService.heartbeat.id', type: 'string' },
			{ name: 'AgentActivityService.heartbeat.input', type: 'AgentInput' },
			{ name: 'AgentActivityService.finish.id', type: 'string' },
			{ name: 'AgentActivityService.finish.failed', type: 'boolean' },
			{ name: 'AgentActivityService.finish.outcome', type: 'string' }
		],
		outputs: [
			{ name: 'AgentActivityService.register', type: 'Promise<StoredAgent>' },
			{ name: 'AgentActivityService.heartbeat', type: 'Promise<AgentBeat>' },
			{ name: 'AgentActivityService.finish', type: 'Promise<void>' },
			{ name: 'AgentActivityService.roster', type: 'Promise<AgentRoster>' }
		],
		errors: [{ name: 'ExpectedCliError', type: 'thrown' }]
	}
};

/**
 * An invented service titled by what it does, not by its class: revision metadata names the class
 * OrderFeed and its methods, initialize among them. No method symbol is listed, so what each
 * method takes, returns and throws is known only from the contract.
 */
export const orderFeed: Declared = {
	id: 'app.service.order-feed',
	title: 'Newest orders of an account',
	responsibility: 'Reads the newest orders of one account once it is initialized.',
	source: 'src/services/OrderFeed.ts',
	className: 'OrderFeed',
	methods: ['initialize', 'latest'],
	symbols: ['OrderFeed'],
	contract: {
		inputs: [
			{ name: 'OrderFeed.constructor.accountId', type: 'string', examples: ['account-7'] },
			{ name: 'OrderFeed.initialize.timeoutMs', type: 'number', examples: [500] }
		],
		outputs: [
			{ name: 'OrderFeed.initialize', type: 'Promise<void>' },
			{ name: 'OrderFeed.latest', type: 'Promise<Order[]>' }
		],
		errors: [
			{
				name: 'OrderFeed.initialize.timeout',
				type: 'TimeoutError',
				examples: [{ name: 'TimeoutError', message: 'The feed did not answer in 500 ms.' }]
			}
		]
	}
};

const store = units.find((unit) => unit.id === ids.store)!;

/** A shared service of the synthetic history, used as OrderStore is, with its declared contract. */
export function serviceUnit(declared: Declared): HarnessUnit {
	const { source, symbols, className, methods, ...named } = declared;
	const consumers = [{ unit: ids.list }, { unit: ids.search }];
	return {
		...store,
		...serviceMetadata(consumers, className, source),
		serviceClasses: [{ ...serviceClassProof(className, source, consumers), methods }],
		...named,
		owns: { source: [source], symbols },
		runtime: { kind: 'module', targets: [{ kind: 'module', entry: source }] },
		version: `v-${declared.id}`
	};
}

/** The selected revision with both method-scoped services beside the synthetic orders. */
export function withServiceContracts(detail: HarnessRevision): HarnessRevision {
	const added = [agentActivity, orderFeed].map(serviceUnit);
	const registry = { ...detail.registry, units: [...detail.registry.units, ...added] };
	return { ...detail, registry };
}
