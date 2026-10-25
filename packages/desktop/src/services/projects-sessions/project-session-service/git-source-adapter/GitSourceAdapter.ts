import { ModuleDataService } from '../../../../../../../src/services/git-source-history/ModuleDataService';
import { moduleDataRequired } from '../../../../../../../src/services/git-source-history/module-data-service/moduleDataAdmission';
import { createHash } from 'node:crypto';
import { basename } from 'node:path';
import { componentManifestSchema } from '../../../../../../../src/lib/contracts';
import { gitBlobs } from './gitBlobs';
import type { ComponentManifest } from '../../../../../../../src/lib/contracts';
import type {
	BranchInfo,
	CommitInfo,
	Revision
} from '../../../../models/development-tooling/Desktop.types';
import { gitFiles } from './gitRead';
import { gitRead, gitRevision, gitText } from '../../../../utils/projects-sessions/gitRead';
import { readUnitDocumentation } from '../../../../../../../src/utils/unit-documentation/unitDocumentation';

export class GitSourceAdapter {
	constructor(readonly root: string) {}
	async branches(): Promise<BranchInfo[]> {
		const current = (
			await gitRead(this.root, ['symbolic-ref', '--quiet', '--short', 'HEAD']).catch(() => '')
		).trim();
		const refs = await gitRead(this.root, [
			'for-each-ref',
			'--format=%(refname:short)%00%(objectname)',
			'refs/heads/'
		]);
		return refs
			.trim()
			.split('\n')
			.filter(Boolean)
			.map((line) => {
				const [name, tip] = line.split('\0');
				return { name, tip, current: name === current };
			});
	}
	async revision(query: { branch: string | null; commit: string | null }): Promise<Revision> {
		const branches = await this.branches(),
			branch =
				branches.find((b) => b.name === query.branch) ||
				(!query.branch ? branches.find((b) => b.current) : null);
		if (!branch)
			throw new Error(
				'Select a local branch. Detached HEAD is read-only and must have a named branch.'
			);
		const commit = query.commit ? await gitRevision(this.root, query.commit) : branch.tip;
		if (query.commit)
			await gitRead(this.root, ['merge-base', '--is-ancestor', commit, branch.tip]).catch(() => {
				throw new Error('This commit is outside the selected branch ancestry.');
			});
		return { branch: branch.name, commit, tip: branch.tip, atTip: commit === branch.tip };
	}
	async commits(branch: string): Promise<CommitInfo[]> {
		const revision = await this.revision({ branch, commit: null });
		const raw = await gitRead(this.root, [
			'log',
			'-200',
			'--format=%H%x00%aI%x00%cI%x00%s',
			revision.tip
		]);
		return raw
			.trim()
			.split('\n')
			.filter(Boolean)
			.map((line) => {
				const [hash, authoredAt, committedAt, subject] = line.split('\0');
				return { hash, authoredAt, committedAt, subject };
			});
	}
	private registry = new Map<string, Promise<ComponentManifest[]>>();
	async units(revision: string): Promise<ComponentManifest[]> {
		const commit = await gitRevision(this.root, revision);
		if (await moduleDataRequired(this.root, commit))
			return (await new ModuleDataService(this.root).require(commit)).declarations;
		if (!this.registry.has(commit)) this.registry.set(commit, this.readUnits(commit));
		return this.registry.get(commit)!;
	}
	private async readUnits(commit: string): Promise<ComponentManifest[]> {
		const paths = (await gitFiles(this.root, commit)).filter((p) =>
			/^specification\/units\/[^/]+\.json$/.test(p)
		);
		const blobs = await gitBlobs(this.root, { revision: commit, paths });
		return paths.map((path) => {
			const unit = componentManifestSchema.parse(JSON.parse(blobs.get(path)!.toString()));
			if (unit.id + '.json' !== basename(path))
				throw new Error('Invalid component manifest identity: ' + path);
			return unit;
		});
	}

	async changed(revision: string): Promise<Set<string>> {
		const raw = await gitRead(this.root, [
			'diff-tree',
			'--root',
			'--no-commit-id',
			'--name-only',
			'-r',
			'-z',
			revision
		]);
		return new Set(raw.split('\0').filter(Boolean));
	}
	async sources(unit: ComponentManifest, revision: string): Promise<string[]> {
		const files = await gitFiles(this.root, revision);
		return files.filter((path) =>
			unit.owns.source.some(
				(owned) => path === owned || path.startsWith(owned.replace(/\/$/, '') + '/')
			)
		);
	}
	async source(unit: ComponentManifest, revision: string, path: string) {
		if (!(await this.sources(unit, revision)).includes(path))
			throw new Error('This file is outside the selected entity source contract.');
		return { path, text: await gitText(this.root, revision, path) };
	}
	async documentation(unit: ComponentManifest | undefined, revision: string) {
		if (!unit?.documentation) return undefined;
		const commit = await gitRevision(this.root, revision);
		return readUnitDocumentation({ read: (path) => gitText(this.root, commit, path) }, unit);
	}
	async size(unit: ComponentManifest, revision: string) {
		const sizes = await Promise.all(
			(await this.sources(unit, revision)).map(async (path) =>
				Number((await gitRead(this.root, ['cat-file', '-s', revision + ':' + path])).trim())
			)
		);
		return {
			available: sizes.length > 0,
			text: sizes.length
				? (sizes.reduce((a, b) => a + b, 0) / 1024).toFixed(1) + ' KB'
				: 'Not measured'
		};
	}
	contractHash(unit: ComponentManifest) {
		return createHash('sha256').update(JSON.stringify(unit.contract)).digest('hex');
	}
}
