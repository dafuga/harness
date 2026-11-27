import { vi } from 'vitest';
import { AgentToolSafetyService } from '../../../src/lib/runtime';
import type {
	AgentToolDefinition,
	AgentToolEvent,
	AgentToolJournalTransaction,
	AgentToolPolicy,
	AgentToolSafetyOptions
} from '../../../src/lib/runtime';

export const second = 1000;
export const agentId = 'agent-1';
export const resource = 'fixture';
export const fixtureDocument = 'owner-only fixture';

export function proposal(tool: string, destination = resource, message = fixtureDocument): string {
	return JSON.stringify({ tool, input: { destination, message } });
}

export function fixture() {
	let now = 1000 * second;
	let journalReady = true;
	let policyReady = true;
	const events: AgentToolEvent[] = [];
	const definitions = {
		read_file: 'file-read',
		lookup: 'network-read',
		pay: 'payment',
		transfer: 'chain-write',
		send: 'message',
		delete: 'delete',
		publish: 'publish',
		deploy: 'deploy',
		shell: 'shell',
		sign: 'credential-use',
		share: 'external-output'
	} satisfies Record<string, AgentToolDefinition['action']>;
	const policy: AgentToolPolicy = {
		revision: '1',
		specialty: 'researcher',
		declaredTools: Object.keys(definitions),
		grants: Object.keys(definitions).map((tool) => ({ tool, resource })),
		maxCallsPerMinute: 16,
		budgets: { USD: { perAction: 50, lifetime: 75 } }
	};
	const execute = vi.fn(async (assertCurrent: () => void) => {
		assertCurrent();
		return 'effect result';
	});
	const tools = buildTools(definitions, execute);

	const checkContent = vi.fn<NonNullable<AgentToolSafetyOptions['checkContent']>>(() => true);
	const options: AgentToolSafetyOptions = {
		tools,
		now: () => now,
		policy: () => (policyReady ? { ...policy } : undefined),
		checkContent,
		journal: openJournal(events, () => journalReady)
	};
	const safety = new AgentToolSafetyService(options);
	return {
		safety,
		execute,
		checkContent,
		policy,
		events,
		options,
		advance: (ms: number) => (now += ms),
		revoke: () => (policyReady = false),
		closeJournal: () => (journalReady = false)
	};
}

function buildTools(
	definitions: Record<string, AgentToolDefinition['action']>,
	execute: (assertCurrent: () => void) => unknown
) {
	const tools: Record<string, AgentToolDefinition> = {};
	for (const [tool, action] of Object.entries(definitions)) {
		tools[tool] = {
			action,
			prepare(input) {
				if (!input || typeof input !== 'object') return undefined;
				if (!('destination' in input) || typeof input.destination !== 'string') return undefined;
				if (!('message' in input) || typeof input.message !== 'string') return undefined;
				const contentNeeded = ['message', 'publish', 'external-output'].includes(action);
				return {
					resource: input.destination,
					summary: 'Fixture action',
					content: contentNeeded ? input.message : undefined,
					charge: tool === 'pay' ? { currency: 'USD', maximum: 50 } : undefined,
					execute
				};
			}
		};
	}
	return tools;
}

function openJournal(
	events: AgentToolEvent[],
	ready: () => boolean
): AgentToolSafetyOptions['journal'] {
	return {
		transaction<T>(write: (journal: AgentToolJournalTransaction) => T): T {
			if (!ready()) throw new Error('Private journal exception');
			const appended: AgentToolEvent[] = [];
			const result = write({
				append: (event) => appended.push(event),
				pending(id) {
					const held = events.find((event) => event.state === 'held' && event.approval.id === id);
					const spent = events.some(
						(event) => event.state === 'reserved' && event.approvalId === id
					);
					return !spent && held?.state === 'held' ? held.approval : undefined;
				},
				usage(id, since, currency) {
					const reserved = events
						.filter((event) => event.state === 'reserved')
						.filter((event) => event.agentId === id);
					return {
						count: reserved.filter((event) => event.at > since).length,
						spend: reserved.reduce(
							(sum, event) =>
								sum +
								(event.state === 'reserved' && event.charge && event.charge.currency === currency
									? event.charge.maximum
									: 0),
							0
						)
					};
				}
			});
			events.push(...appended);
			return result;
		}
	};
}
