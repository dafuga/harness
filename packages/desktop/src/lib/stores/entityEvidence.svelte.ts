import type { ExplorerBehavior } from '../../../../reports/src/models/Explorer.types';
import type { DesktopBridge } from '../../models/DesktopBridge.types';
import type { EntityEvidenceQuery, EntityEvidenceResult } from '../../models/DesktopEvidence.types';
import { artifactBytes } from "../../components/recorded-preview/artifactBytes";
import { artifactQuery, type EvidenceSide } from '../../utils/artifactQuery';
import type { EvidenceStatus } from '../../utils/evidenceNotice';
import { evidenceReading } from '../../utils/evidenceReading';

/** What decides which evidence is shown; `stamp` names the pinned revisions of the project. */
export interface EvidenceTarget {
	scope: EntityEvidenceQuery | null;
	planned: boolean;
	stamp: string;
}

function words(cause: unknown): string {
	return cause instanceof Error ? cause.message : String(cause);
}
const unlisted = 'This capture is not listed by the evidence that is shown.';
const left = 'This capture is no longer shown.';

/**
 * The recorded runtime evidence of the one entity that is shown, read when it is first looked
 * at and again only when the entity, the scope or the pinned revisions change. An answer for
 * what is no longer shown is dropped, and every object URL that was made is revoked with it.
 */
class EntityEvidenceState {
	status = $state<EvidenceStatus>('idle');
	result = $state.raw<EntityEvidenceResult | null>(null);
	error = $state('');
	/** The behaviour with every result read and checked; undefined until then, null when lost. */
	read = $state.raw<ExplorerBehavior | null | undefined>(undefined);
	/** Why the backend gave no bytes for a result, by the hash of that result. */
	refusals = $state.raw<Record<string, string>>({});
	private serial = 0;
	private shown: string | null = null;
	private bridge: DesktopBridge | undefined;
	private scope: EntityEvidenceQuery | null = null;
	private readonly media = new Map<string, Promise<string>>();
	private readonly urls: string[] = [];

	/** Shows the evidence of a target; the one that is already shown is not read again. */
	show(bridge: DesktopBridge | undefined, target: EvidenceTarget): void {
		const key = JSON.stringify(target);
		if (key === this.shown && bridge === this.bridge) return;
		this.reset();
		[this.shown, this.bridge, this.scope] = [key, bridge, target.scope];
		if (target.planned || !target.scope) {
			this.status = target.planned ? 'planned' : 'idle';
		} else if (!bridge?.evidence) {
			this.status = 'unavailable';
		} else {
			this.status = 'loading';
			void this.load(bridge, target.scope, this.serial);
		}
	}

	private async load(bridge: DesktopBridge, scope: EntityEvidenceQuery, token: number) {
		try {
			const result = await bridge.evidence!(scope);
			if (token !== this.serial) return;
			this.result = result;
			this.status = 'ready';
		} catch (cause) {
			if (token !== this.serial) return;
			this.error = words(cause);
			this.status = 'failed';
			return;
		}
		if (this.result.behavior.rows.length === 0) return;
		const read = await evidenceReading(bridge, this.result, scope).catch(() => null);
		if (token !== this.serial) return;
		this.read = read?.behavior ?? null;
		this.refusals = read?.refusals ?? {};
	}

	/** An object URL of the checked bytes of one listed capture; each capture is read once. */
	url(side: EvidenceSide, file: string): Promise<string> {
		const key = `${side}|${file}`;
		const known = this.media.get(key) ?? this.made(side, file, this.serial);
		this.media.set(key, known);
		return known;
	}

	private async made(side: EvidenceSide, file: string, token: number): Promise<string> {
		const query =
			this.result && this.scope ? artifactQuery(this.result, this.scope, side, file) : null;
		if (!query || !this.bridge) throw new Error(unlisted);
		const { bytes, mediaType } = await artifactBytes(this.bridge, query);
		if (token !== this.serial) throw new Error(left);
		const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: mediaType }));
		this.urls.push(url);
		return url;
	}

	/** Lets go of all of it: answers still under way are dropped, object URLs are revoked. */
	reset(): void {
		this.serial++;
		for (const url of this.urls.splice(0)) URL.revokeObjectURL(url);
		this.media.clear();
		[this.shown, this.bridge, this.scope] = [null, undefined, null];
		[this.result, this.read, this.refusals] = [null, undefined, {}];
		[this.status, this.error] = ['idle', ''];
	}
}

export function createEntityEvidenceStore() {
	return new EntityEvidenceState();
}
export type EntityEvidence = EntityEvidenceState;
