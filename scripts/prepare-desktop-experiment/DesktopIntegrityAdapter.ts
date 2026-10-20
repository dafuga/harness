import {
	calculateIntegrityDigestForApp,
	getStoredIntegrityDigestForApp,
	setStoredIntegrityDigestForApp
} from '@electron/asar';
import { copyFile, mkdir, mkdtemp, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export class DesktopIntegrityAdapter {
	async update(app: string): Promise<void> {
		if (!app.endsWith('/Codex Harness Experimental.app'))
			throw new Error('Integrity changes require the experimental copy');
		const temporary = await mkdtemp(join(tmpdir(), 'harness-desktop-integrity-'));
		const alias = join(temporary, 'Bundle.app');
		const framework = join(alias, 'Contents/Frameworks/Electron Framework.framework');
		try {
			await mkdir(framework, { recursive: true });
			await copyFile(join(app, 'Contents/Info.plist'), join(alias, 'Contents/Info.plist'));
			await symlink(
				join(app, 'Contents/Frameworks/Codex Framework.framework/Codex Framework'),
				join(framework, 'Electron Framework')
			);
			const current = getStoredIntegrityDigestForApp(alias);
			if (!current.used) throw new Error('Expected enabled ASAR integrity');
			const digest = calculateIntegrityDigestForApp(alias, 1);
			setStoredIntegrityDigestForApp(alias, digest);
			const result = getStoredIntegrityDigestForApp(alias);
			if (!result.used || !digest.used || !result.sha256Digest.equals(digest.sha256Digest))
				throw new Error('Integrity digest verification failed');
		} finally {
			await rm(temporary, { recursive: true, force: true });
		}
	}
}
