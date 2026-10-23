import type { StoredDirectory } from './EvidenceBranchRepository.types';
import { setTimeout as delay } from 'node:timers/promises';
import {
	EvidenceTreeAdapter,
	type TreeFile
} from '../../../adapters/verification-evidence/EvidenceTreeAdapter';
import { fail } from '../../../core/development-tooling/errors';
import { evidenceMarker, evidenceRef } from '../../../core/git-source-history/historyTypes';
import { lfsAttributes } from './lfsPointer';

const marker = `${JSON.stringify({ schemaVersion: 1, kind: 'harness-evidence' })}\n`;

const attempts = 20;

/**
 * The evidence branch: an append-only history in which every record has its own directory.
 * Nothing is rewritten; a directory that exists is either identical or a refused conflict.
 */
export class EvidenceBranchRepository {
	readonly tree: EvidenceTreeAdapter;

	constructor(root: string) {
		this.tree = new EvidenceTreeAdapter(root);
	}

	tip(): Promise<string | undefined> {
		return this.tree.tip(evidenceRef);
	}

	/**
	 * Adds one directory in a new commit. `key` is the file whose content identifies the
	 * directory, so adding the same record again changes nothing.
	 */
	async add(
		directory: string,
		files: TreeFile[],
		message: string,
		key: string
	): Promise<StoredDirectory> {
		for (let attempt = 0; attempt < attempts; attempt += 1) {
			const tip = await this.tip();
			const existing = tip ? await this.tree.read(tip, `${directory}/${key}`) : undefined;
			if (tip && existing) return this.existing(tip, directory, files, { key, existing });
			const placed = files.map((file) => ({ ...file, path: `${directory}/${file.path}` }));
			const commit = await this.tree.commit({
				parents: tip ? [tip] : [],
				files: [...this.preamble(), ...placed],
				message
			});
			if (await this.tree.advance(evidenceRef, commit, tip)) return { commit, created: true };
			// Another writer added a record first: build again on top of theirs.
			await delay(5 + Math.random() * 25 * (attempt + 1));
		}
		return fail('The evidence branch kept moving while a record was being added; try again.');
	}

	/** The marker and attributes every evidence tree starts with. */
	private preamble(): TreeFile[] {
		return [
			{ path: evidenceMarker, content: { bytes: marker } },
			{ path: '.gitattributes', content: { bytes: lfsAttributes() } }
		];
	}

	private async existing(
		tip: string,
		directory: string,
		files: TreeFile[],
		identity: { key: string; existing: Buffer }
	): Promise<StoredDirectory> {
		const wanted = files.find((file) => file.path === identity.key)?.content;
		const bytes = wanted && 'bytes' in wanted ? Buffer.from(wanted.bytes) : undefined;
		if (!bytes?.equals(identity.existing)) {
			return fail(
				`Evidence path ${directory} already holds different content; nothing was changed.`
			);
		}
		const added = await this.tree.git.run([
			'log',
			'--diff-filter=A',
			'--format=%H',
			tip,
			'--',
			`${directory}/${identity.key}`
		]);
		return { commit: added.split('\n').filter(Boolean).pop() ?? tip, created: false };
	}
}

export type { StoredDirectory } from './EvidenceBranchRepository.types';
