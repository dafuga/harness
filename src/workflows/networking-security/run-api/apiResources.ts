import type { HarnessApiService } from '../../../services/networking-security/HarnessApiService';
import type { ApiSnapshot } from '../../../services/networking-security/HarnessApiService.types';
import { apiQuery } from './apiInput';
import { fail } from '../../../core/development-tooling/errors';

export const apiResources = {
	resources: [
		'projects',
		'snapshot',
		'entities',
		'contracts',
		'source',
		'history',
		'messages',
		'threads',
		'evidence',
		'activity',
		'build',
		'agents'
	],
	reads: [
		'snapshot',
		'entity',
		'source',
		'history',
		'messages',
		'threads',
		'evidence',
		'artifact',
		'image'
	],
	agents: ['providers', 'startRun', 'events', 'cancelRun', 'openThread', 'approve', 'createPlan'],
	request:
		'Use request <METHOD> /api/<path> for every server resource, including future endpoints.',
	permissions:
		'All operations retain the selected server permissions. Agent writes require an available executor and writable branch tip.'
};

export async function apiResource(
	client: HarnessApiService,
	resource: string,
	id?: string
): Promise<unknown> {
	const direct: Record<string, () => Promise<unknown>> = {
		build: () => client.http.request('GET', '/harness/data/build.json'),
		activity: () => client.http.request('GET', '/api/project-activity'),
		agents: () => client.call('providers', {}),
		providers: () => client.call('providers', {})
	};
	if (Object.hasOwn(direct, resource)) return direct[resource]();
	if (resource === 'projects')
		return client.hosted ? client.read('projects') : [(await client.snapshot()).project];
	const snapshot = await client.snapshot();
	const collection = catalogResource(snapshot, resource);
	if (collection !== undefined) return collection;
	if (!id) fail('Name the entity id after this resource, or use a raw /api/ path.');
	const query = {
		entityId: id,
		branch: snapshot.revision.branch,
		commit: snapshot.revision.commit
	};
	if (resource === 'contracts')
		return ((await client.read('entity', query)).data as { contract: unknown }).contract;
	if (resource === 'threads' && !client.hosted)
		return ((await client.read('entity', query)).data as { threads: unknown }).threads;
	return client.read(resource, {
		...Object.fromEntries(apiQuery(client.options.query)),
		...query,
		mode: client.options.commit ? 'commit' : 'current'
	});
}

function catalogResource(snapshot: ApiSnapshot, resource: string): unknown {
	if (resource === 'snapshot') return snapshot;
	if (['entities', 'units'].includes(resource)) return snapshot.entities;
	if (['branches', 'commits', 'capabilities'].includes(resource))
		return (snapshot as unknown as Record<string, unknown>)[resource];
	if (
		[
			'pages',
			'layouts',
			'components',
			'functions',
			'models',
			'services',
			'configs',
			'types',
			'platforms',
			'styles'
		].includes(resource)
	)
		return snapshot.entities.filter((entity) => entity.category === resource);
	return undefined;
}
