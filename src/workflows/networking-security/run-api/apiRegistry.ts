import type { HarnessApiService } from '../../../services/networking-security/HarnessApiService';
import type { ApiSnapshot } from '../../../services/networking-security/HarnessApiService.types';
import type { ComponentManifest } from '../../../core/development-tooling/unitTypes';
import { fail } from '../../../core/development-tooling/errors';

/** Registry reads include every declared resource kind, independent of visual catalog admission. */
export async function apiRegistry(
	client: HarnessApiService,
	snapshot: ApiSnapshot,
	resource: string,
	id?: string
): Promise<unknown> {
	const query = { branch: snapshot.revision.branch, commit: snapshot.revision.commit };
	if (resource === 'contracts' && id) {
		const planned = await catalogContract(client, { entityId: id, ...query });
		if (planned !== undefined) return planned;
	}
	const result = (await client.read('registry', query)).data as {
		commit: string;
		units: ComponentManifest[];
	};
	if (resource === 'registry') return result;
	if (resource === 'units') return result.units;
	if (!id) return result.units.map((unit) => ({ id: unit.id, contract: unit.contract }));
	const unit = result.units.find((unit) => unit.id === id);
	if (unit) return unit.contract;
	return fail('No registered unit or saved plan has this id at the selected revision.');
}

async function catalogContract(
	client: HarnessApiService,
	query: Record<string, string>
): Promise<unknown> {
	try {
		return ((await client.read('entity', query)).data as { contract: unknown }).contract;
	} catch (cause) {
		const reason = cause instanceof Error ? cause.message : '';
		if (
			/^Harness API HTTP 404:/.test(reason) ||
			/^Harness API HTTP 400: Entity not found at this revision\./.test(reason)
		)
			return undefined;
		throw cause;
	}
}
