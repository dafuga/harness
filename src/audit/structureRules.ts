import type { AuditStructure } from './adapters/types';
import {
	allowedDirectSrcFiles,
	allowedRootTypeScriptFiles,
	allowedSrcFolders,
	allowedTestFolders
} from './structureCatalog';
import type { AuditFinding } from './types';

export function auditHarnessStructure(structure: AuditStructure): AuditFinding[] {
	return [
		...auditFolderNames(structure.dirs),
		...auditSourceFolders(structure.dirs),
		...auditTestFolders(structure.dirs),
		...auditDbFolders(structure.dirs),
		...auditRootTypeScriptFiles(structure.files),
		...auditSourceFiles(structure.files),
		...auditSpecFiles(structure.files)
	];
}

function auditFolderNames(dirs: string[]): AuditFinding[] {
	return dirs.flatMap((dir) => {
		const invalid = pathSegments(dir).find((segment) => !isAllowedFolderName(segment));
		if (!invalid) return [];
		return [
			{
				path: dir,
				rule: 'folder-name-pattern',
				message: `Folder "${invalid}" should use lowercase kebab-case or a SvelteKit route segment.`
			}
		];
	});
}

function auditSourceFolders(dirs: string[]): AuditFinding[] {
	return dirs.flatMap((dir) => {
		const segments = pathSegments(dir);
		if (segments[0] !== 'src' || segments.length < 2 || allowedSrcFolders.has(segments[1])) {
			return [];
		}
		return [
			{
				path: dir,
				rule: 'harness-source-structure',
				message: `Source folder "${segments[1]}" is outside the Harness scaffold catalog.`
			}
		];
	});
}

function auditTestFolders(dirs: string[]): AuditFinding[] {
	return dirs.flatMap((dir) => {
		const segments = pathSegments(dir);
		if (segments[0] === 'tests') return auditE2eFolder(dir, segments);
		if (segments[0] !== 'test' || segments.length < 2 || allowedTestFolders.has(segments[1])) {
			return [];
		}
		return [
			{
				path: dir,
				rule: 'harness-test-structure',
				message: `Test folder "${segments[1]}" is outside the Harness scaffold catalog.`
			}
		];
	});
}

function auditDbFolders(dirs: string[]): AuditFinding[] {
	return dirs.flatMap((dir) => {
		const segments = pathSegments(dir);
		if (segments[0] !== 'db' || segments.length < 2) return [];
		if (segments[1] === 'migrations' || segments[1] === 'seed-data') return [];
		return [
			{
				path: dir,
				rule: 'harness-db-structure',
				message: 'Database files should live in db/migrations or db/seed-data.'
			}
		];
	});
}

function auditRootTypeScriptFiles(files: string[]): AuditFinding[] {
	return files.flatMap((file) => {
		if (!isRootTypeScriptFile(file) || allowedRootTypeScriptFiles.has(file)) return [];
		return [
			{
				path: file,
				rule: 'harness-root-file-structure',
				message: 'Root TypeScript files should be config files; implementation belongs in src/.'
			}
		];
	});
}

function auditSourceFiles(files: string[]): AuditFinding[] {
	return files.flatMap((file) => {
		const segments = file.split('/');
		if (segments[0] !== 'src') return [];
		if (segments.length === 2) return auditDirectSourceFile(file, segments[1]);
		if (allowedSrcFolders.has(segments[1])) return [];
		return [
			{
				path: file,
				rule: 'harness-source-structure',
				message: `Source file uses unknown folder "${segments[1]}".`
			}
		];
	});
}

function auditSpecFiles(files: string[]): AuditFinding[] {
	return files.flatMap((file) => {
		if (!file.startsWith('specification/features/')) return [];
		if (
			/^specification\/features\/(?:(?:implemented|planned)\/)?[a-z0-9]+(?:-[a-z0-9]+)*\.md$/.test(
				file
			)
		) {
			return [];
		}
		return [
			{
				path: file,
				rule: 'harness-spec-structure',
				message: 'Feature specs should live in specification/features/ with kebab-case names.'
			}
		];
	});
}

function auditE2eFolder(dir: string, segments: string[]): AuditFinding[] {
	if (segments.length === 1) return [];
	if (segments[1] === 'e2e') return [];
	return [
		{
			path: dir,
			rule: 'harness-e2e-structure',
			message: 'Browser E2E tests should live in tests/e2e.'
		}
	];
}

function auditDirectSourceFile(file: string, name: string): AuditFinding[] {
	if (allowedDirectSrcFiles.has(name)) return [];
	return [
		{
			path: file,
			rule: 'harness-source-structure',
			message:
				'Direct src/ files should be app.html or index.ts; other code belongs in a scaffold folder.'
		}
	];
}

function isAllowedFolderName(segment: string): boolean {
	return (
		segment === '.codex' ||
		segment === '.github' ||
		/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(segment) ||
		/^[a-z0-9]+(?:[-.][a-z0-9]+)*\.spec\.ts$/.test(segment) ||
		/^\[[A-Za-z0-9_-]+\]$/.test(segment) ||
		/^\([a-z0-9]+(?:-[a-z0-9]+)*\)$/.test(segment)
	);
}

function isRootTypeScriptFile(file: string): boolean {
	return !file.includes('/') && /\.tsx?$/.test(file);
}

function pathSegments(path: string): string[] {
	return path.replace(/\/$/, '').split('/');
}
