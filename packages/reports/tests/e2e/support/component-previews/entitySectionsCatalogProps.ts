import { permissionProfiles } from '../../../../../../test/support/permissionProfiles';
import type { ExplorerEntity } from '../../../../src/models/explorer-ui/Explorer.types';
import type { ExplorerScreenProps } from '../../../../src/models/explorer-ui/ExplorerScreen.types';
import * as d from './explorerData';
import { desktopData } from './sealedData';
import { contractPreviewUnit } from './reportEntityContractVariants';

const orders = [
	{ id: 'A-1048', name: 'Ada Lovelace' },
	{ id: 'A-1047', name: 'Grace Hopper' }
];
const documentation = {
	path: 'docs/orders/filter-orders.md',
	setup: `const orders = ${JSON.stringify(orders, null, 2)};`,
	examples: [
		{
			name: 'Match a customer by name',
			call: 'filterOrders(orders, "Ada")',
			input: { orders, searchText: 'Ada' },
			output: [orders[0]]
		}
	]
};

/** The selected section receives its own recording, documentation or declared endpoint policy. */
export function populatedEntitySections(
	host: ExplorerScreenProps,
	variant: string
): { host: ExplorerScreenProps; entity: ExplorerEntity } | null {
	if (variant === 'contract') {
		return {
			host: { ...host, route: { ...host.route, tab: 'contract' } },
			entity: { ...d.entity, unit: contractPreviewUnit(d.entity.unit) }
		};
	}
	if (variant === 'states' || variant === 'tests') {
		return {
			host: {
				...host,
				route: { ...host.route, tab: variant },
				lens: { ...host.lens, evidence: () => desktopData.entitySectionsEvidence }
			},
			entity: d.entity
		};
	}
	if (variant === 'audio') return audioSection(host);
	if (variant === 'examples') {
		const entity = d.entities.find((item) => item.id === d.ids.filter)!;
		return {
			host: d.host('functions', 'examples'),
			entity: { ...entity, unit: { ...entity.unit, documentation } }
		};
	}
	if (variant !== 'permissions') return null;
	const id = 'app.endpoint.orders';
	const route = {
		...host.route,
		category: 'apis' as const,
		entity: id,
		tab: 'permissions' as const
	};
	return {
		host: {
			...host,
			route,
			scope: { ...host.scope, location: route },
			head: { ...host.head, permissions: permissionProfiles }
		},
		entity: {
			...d.entity,
			id,
			name: 'OrdersApi',
			category: 'apis' as const,
			unit: { ...d.entity.unit, id, kind: 'endpoint', title: 'OrdersApi' }
		}
	};
}

function audioSection(host: ExplorerScreenProps) {
	const entity = d.entities.find((item) => item.id === d.ids.search)!;
	const route = { ...host.route, entity: entity.id, tab: 'audio' as const };
	const evidence = {
		...d.audioEvidence,
		mode: 'commit' as const,
		before: d.recordedAudioSide(d.audioEvidence.after, host.scope.parent!),
		after: d.recordedAudioSide(d.audioEvidence.after, host.scope.commit)
	};
	return {
		entity,
		host: {
			...host,
			route,
			scope: { ...host.scope, location: route },
			lens: { ...host.lens, evidence: () => evidence }
		}
	};
}
