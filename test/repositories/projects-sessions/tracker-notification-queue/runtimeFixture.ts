import type { DatabaseSync } from 'node:sqlite';
import { TrackerNativeRuntimeService } from '../../../../src/services/projects-sessions/TrackerNativeRuntimeService';
import type { TrackerNativeNotificationOptions } from '../../../../src/services/projects-sessions/TrackerNativeRuntimeService.types';
import type {
	TrackerDeliveryRequest,
	TrackerDeliveryResult
} from '../../../../src/services/projects-sessions/TrackerNotificationService.types';
import {
	chief,
	clock,
	start,
	worker
} from '../../../services/projects-sessions/tracker-notification/fixture';
import { itemId, reference } from './legacyFixture';

export function fixtureRuntime(
	database: DatabaseSync,
	input: {
		batch?: boolean;
		now?: () => number;
		send?: (request: TrackerDeliveryRequest) => Promise<TrackerDeliveryResult>;
	} = {}
) {
	const calls: TrackerDeliveryRequest[] = [];
	const options = {
		resolveDestination: (value: unknown) =>
			value && typeof value === 'object' && 'url' in value && value.url === reference
				? worker
				: undefined,
		webhook: {
			destination: chief,
			batch: input.batch ?? false,
			routes: { 'fixture-agent': { destination: worker } }
		},
		destinations: {
			available: () => true,
			send: async (request: TrackerDeliveryRequest) => {
				calls.push(request);
				return input.send ? input.send(request) : { status: 'sent' };
			}
		}
	} as TrackerNativeNotificationOptions;
	const runtime = new TrackerNativeRuntimeService(database, {
		node: 'fixture-node',
		role: 'hub',
		now: input.now ?? (() => start),
		notification: options
	});
	if (!runtime.notifications) throw new Error('Fixture notification service is required');
	return { calls, service: runtime.notifications };
}

export function putCompletedItem(database: DatabaseSync) {
	database
		.prepare(
			'INSERT INTO items(id, title, kind, status, callback, clocks) VALUES (?, ?, ?, ?, ?, ?)'
		)
		.run(
			itemId,
			'Recovered notification',
			'task',
			'done',
			JSON.stringify({ url: reference, node: 'fixture-node' }),
			JSON.stringify({ status: clock() })
		);
}

export function syntheticReceipt(database: DatabaseSync) {
	database.exec(
		'CREATE TABLE IF NOT EXISTS receipts(destination TEXT, id TEXT, request TEXT, PRIMARY KEY(destination, id))'
	);
	return (request: TrackerDeliveryRequest): Promise<TrackerDeliveryResult> => {
		const encoded = JSON.stringify(request);
		const { destination, id } = request;
		database
			.prepare('INSERT OR IGNORE INTO receipts VALUES(?, ?, ?)')
			.run(destination.id, id, encoded);
		const receipt = database
			.prepare('SELECT request FROM receipts WHERE destination = ? AND id = ?')
			.get(destination.id, id);
		if (receipt?.request !== encoded)
			throw new Error('Synthetic receiver observed a changed request');
		return Promise.resolve({ status: 'sent' });
	};
}
