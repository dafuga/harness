import type { ComponentManifest } from '../../../core/unitTypes';
import { explorerCategories } from '../../../utils/explorerRoute';
import type { HarnessApiService } from '../../../services/networking-security/HarnessApiService';
import type { ApiSnapshot } from '../../../services/networking-security/HarnessApiService.types';
import { apiQuery } from './apiInput';
import { apiRegistry } from './apiRegistry';
import { fail } from '../../../core/development-tooling/errors';

const catalogs: readonly string[] = [...explorerCategories, 'styles'];

export const apiResources = {
	resources: [
		'projects',
		'snapshot',
		'entities',
		'units',
		'registry',
		'contracts',
		'source',
		'history',
		'messages',
		'threads',
		'evidence',
		'activity',
		'build',
		'agents',
		...catalogs
	],
	reads: [
		'registry',
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
	if (['registry', 'units', 'contracts', 'apis'].includes(resource))
		return registeredResource(client, snapshot, resource, id);
	const collection = catalogResource(snapshot, resource);
	if (collection !== undefined) return collection;
	if (!id) fail('Name the entity id after this resource, or use a raw /api/ path.');
	const query = {
		entityId: id,
		branch: snapshot.revision.branch,
		commit: snapshot.revision.commit
	};
	if (resource === 'threads') return threadResource(client, query);
	const fields: Record<string, unknown> = Object.fromEntries(apiQuery(client.options.query));
	if (resource === 'history') fields.page = historyPage(fields.page);
	return client.read(resource, {
		...fields,
		...query,
		mode: client.options.commit ? 'commit' : 'current'
	});
}

async function threadResource(
	client: HarnessApiService,
	query: Record<string, unknown>
): Promise<unknown> {
	if (client.hosted) return client.read('threads', query);
	return ((await client.read('entity', query)).data as { threads: unknown }).threads;
}

function historyPage(page: unknown): number {
	const number = page === undefined ? 1 : Number(page);
	if (!Number.isSafeInteger(number) || number < 1 || number > 10000)
		fail('History pages must be integers from 1 to 10000.');
	return number;
}

function catalogResource(snapshot: ApiSnapshot, resource: string): unknown {
	if (resource === 'snapshot') return snapshot;
	if (resource === 'entities') return snapshot.entities;
	if (['branches', 'commits', 'capabilities'].includes(resource))
		return (snapshot as unknown as Record<string, unknown>)[resource];
	if (
		catalogs.includes(resource) ||
		snapshot.entities.some((entity) => entity.category === resource)
	)
		return snapshot.entities.filter((entity) => entity.category === resource);
	return undefined;
}

function endpoint(unit: ComponentManifest): boolean {
	return ['endpoint', 'api'].includes(unit.kind) && unit.status === 'active';
}

async function registeredResource(
	client: HarnessApiService,
	snapshot: ApiSnapshot,
	resource: string,
	id?: string
): Promise<unknown> {
	const result = await apiRegistry(client, snapshot, resource === 'apis' ? 'units' : resource, id);
	return resource === 'apis' ? (result as ComponentManifest[]).filter(endpoint) : result;
}
