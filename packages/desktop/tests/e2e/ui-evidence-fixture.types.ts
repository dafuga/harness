import type { DesktopBridge } from '../../src/models/DesktopBridge.types';
import type { UnitDocumentation } from '../../../../src/utils/unit-documentation/unitDocumentation';
import type { ComponentManifest } from '../../../../src/lib/contracts';
import type { evidenceData } from './ui-evidence-data';

/**
 * SYNTHETIC BACKEND. A bridge like the one a backend gives the viewer, with the two evidence
 * reads answered from a sealed synthetic history: `evidence` answers what the reports functions
 * made of that history, and `artifact` gives bytes only for a binding that such an answer named.
 * No repository, server, account or credential exists here.
 */
export type Reads = Required<Pick<DesktopBridge, 'evidence' | 'artifact'>>;

export interface EvidenceState {
	calls: Array<Record<string, unknown>>;
	/** How long an evidence read of `entity|mode|commit` takes, in milliseconds. */
	delay: Record<string, number>;
	/** Hashes whose bytes arrive damaged, though the answer still states the recorded hash. */
	corrupt: string[];
	/** While set, bytes are not given until `release` is called. */
	held: Array<() => void> | null;
	/** The pinned evidence moved on: every request for bytes of the old pin is refused. */
	moved: boolean;
	urls: { made: string[]; revoked: string[] };
	/** The object behind each URL the page made and has not let go. */
	objects: Map<string, Blob | MediaSource>;
	cache: (event: { projectId: string; status: string; cachedAt?: string }) => void;
}

export interface Host {
	harness: Record<string, unknown>;
	__evidence: EvidenceState;
}

export type Settings = Pick<EvidenceState, 'delay' | 'corrupt' | 'moved'> & { hold: boolean };

export interface EvidenceOptions extends Partial<Settings> {
	documentation?: Record<string, UnitDocumentation>;
	previews?: Record<string, NonNullable<ComponentManifest['preview']>>;
	example?: Parameters<typeof evidenceData>[2];
	/** Browser diagnostics held by the tip record's first check; synthetic test data only. */
	browserErrors?: unknown[];
	/** An incremental record whose only applicable scenario reuses its earlier passing checks. */
	inheritedOnly?: boolean;
	/** Extra entities declared by the synthetic history to have the recorded search observations. */
	observedUnits?: string[];
	/** A shared project read through a hosted connection: comments only, and a cache channel. */
	shared?: boolean;
	/** False for a backend without the evidence reads. */
	reads?: boolean;
}
