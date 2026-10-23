import type { BridgeOptions, Reads } from './evidence-fixture.types';
import type { Component } from 'svelte';
import { render } from 'svelte/server';
import { vi } from 'vitest';
import { createEntityEvidenceStore } from '../src/lib/stores/entityEvidence.svelte';
import type { EntityDetail } from '../src/models/Desktop.types';
import type { DesktopBridge } from '../src/models/DesktopBridge.types';
import type { EntityEvidenceQuery } from '../src/models/DesktopEvidence.types';
import {
	bindingKey,
	branch,
	commits,
	evidenceData,
	sharedProject,
	type EvidenceData
} from '../tests/e2e/ui-evidence-data';

export * from '../tests/e2e/ui-evidence-data';
export const refusal = 'The pinned evidence changed; read the entity again.';
export const data = evidenceData();

/**
 * SYNTHETIC BACKEND for unit tests: the two evidence reads over the sealed synthetic history of
 * the UI tests, bound as a backend binds them. Nothing but that history stands behind it.
 */
export function evidenceBridge(options: BridgeOptions = {}, from: EvidenceData = data) {
	const calls: Array<Record<string, unknown>> = [];
	const reads: Reads = {
		evidence: async (input) => {
			calls.push({ op: 'evidence', ...input });
			const found = from.results[`${input.entityId}|${input.mode}|${input.commit}`];
			if (!found || input.branch !== from.branch)
				throw new Error('No recorded evidence is bound to this address.');
			return found;
		},
		artifact: async (input) => {
			calls.push({ op: 'artifact', ...input });
			const sha256 = from.bindings[bindingKey({ ...input })];
			const kept = sha256 ? from.bytes[sha256] : undefined;
			if (!kept) throw new Error('This capture is not part of the selected record.');
			if (options.refuse?.includes(sha256)) throw new Error(refusal);
			const bytes = new Uint8Array(kept.data);
			if (options.corrupt?.includes(sha256)) bytes[bytes.length - 1] ^= 1;
			return { bytes, mediaType: kept.mediaType, sha256 };
		}
	};
	return { bridge: reads as unknown as DesktopBridge, calls };
}

/** What the viewer asks for one entity: its branch tip, or the commit that is named. */
export function scopeOf(entityId: string, commit: string | null = null): EntityEvidenceQuery {
	const mode = commit ? 'commit' : 'current';
	return { entityId, commit: commit ?? commits.tip, branch, mode, projectId: sharedProject };
}

/** A store that has read the evidence of one entity, with every result read as well. */
export async function shownEvidence(scope: EntityEvidenceQuery, options: BridgeOptions = {}) {
	const { bridge, calls } = evidenceBridge(options);
	const store = createEntityEvidenceStore();
	store.show(bridge, { scope, planned: false, stamp: '' });
	await vi.waitFor(() => {
		if (store.status !== 'ready') throw new Error(store.status);
		if (store.result!.behavior.rows.length > 0 && store.read === undefined)
			throw new Error('unread');
	});
	return { store, result: store.result!, calls, bridge };
}

/** A component as it is first drawn, without the marks the compiler leaves in the markup. */
export function drawn<Props extends Record<string, unknown>>(
	component: Component<Props>,
	props: Props
): string {
	const { body } = render(component as Component<Record<string, unknown>>, { props });
	return body.replace(/<!--.*?-->/gs, '').replace(/\s+/g, ' ');
}

/** The entity of the synthetic project as the viewer is given it. */
export const entityOf = (id: string) =>
	data.entities.find((item) => item.id === id) as unknown as EntityDetail;

export type { BridgeOptions } from './evidence-fixture.types';
