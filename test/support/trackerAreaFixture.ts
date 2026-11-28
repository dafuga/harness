import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { onTestFinished, vi } from 'vitest';
import { TrackerNativeRuntimeService } from '../../src/services/projects-sessions/TrackerNativeRuntimeService';
import { TrackerSyncAuthService } from '../../src/services/networking-security/TrackerSyncAuthService';
import type { TrackerDispatchRunner } from '../../src/services/projects-sessions/TrackerDispatchSchedulerService.types';
import type { TrackerHostRepository } from '../../src/services/projects-sessions/tracker-native-runtime-service/nativeTrackerHostEffects.types';
import { fixturePolicy, primary } from './trackerDispatcherFixture';
import { fixtureSecret } from './trackerDispatchQueueFixture';

/** A checkout routed like a live Mac: a GitHub origin and, by default, no GitHub read binding. */
export function areaCheckout(root: string, files: string[] = []): TrackerHostRepository {
	const repo = join(root, 'repo');
	mkdirSync(repo, { recursive: true });
	const git = (...args: string[]) => execFileSync('/usr/bin/git', ['-C', repo, ...args]);
	git('init', '-q');
	git('remote', 'add', 'origin', 'https://github.com/fixture/project.git');
	for (const file of files) {
		mkdirSync(dirname(join(repo, file)), { recursive: true });
		writeFileSync(join(repo, file), 'module');
	}
	if (files.length) git('add', '.');
	return { repo, platform: 'macos' };
}

/** Open PR #41 moves old/file.ts to new/file.ts; open PR #42 edits different.ts. */
export function withOpenPulls(root: string, route: TrackerHostRepository): TrackerHostRepository {
	const configDirectory = join(root, 'gh');
	const executable = join(root, 'github-reader');
	mkdirSync(configDirectory, { mode: 0o700 });
	const changed = {
		number: 41,
		author: { login: 'owner' },
		headRefName: 'move',
		headRefOid: 'a'.repeat(40),
		baseRefName: 'main',
		changedFiles: 1,
		files: [{ path: 'new/file.ts', changeType: 'RENAMED' }]
	};
	const unrelated = {
		...changed,
		number: 42,
		files: [{ path: 'different.ts', changeType: 'MODIFIED' }]
	};
	const output = JSON.stringify([changed, unrelated]);
	const rename = JSON.stringify([[{ filename: 'new/file.ts', previous_filename: 'old/file.ts' }]]);
	writeFileSync(
		executable,
		`#!/bin/sh\ncase "$1" in\npr) echo '${output}';;\napi) echo '${rename}';;\n*) exit 1;;\nesac\n`,
		{ mode: 0o700 }
	);
	return { ...route, github: { executable, configDirectory } };
}

/** One hub launcher whose sessions are synthetic; each start records the brief it received. */
export function areaLauncher(route: TrackerHostRepository) {
	const database = new DatabaseSync(':memory:');
	onTestFinished(() => database.close());
	const start = vi.fn<TrackerDispatchRunner['start']>(async ({ run, key }) => ({
		type: 'session',
		session: { id: run.item_id, key, state: 'live', startedAt: Date.now() }
	}));
	const runtime = new TrackerNativeRuntimeService(database, {
		node: primary,
		role: 'hub',
		hostEffects: {
			launch: { driver: '/unused-fixture', repositories: { Harness: route } }
		},
		dispatch: {
			policy: fixturePolicy(Date.now),
			runner: { start, observe: async () => undefined, stop: async () => true }
		},
		syncResponder: { auth: new TrackerSyncAuthService(fixtureSecret) }
	});
	return {
		runtime,
		queue(id: string, notes: string) {
			runtime.store.appendLocal({
				itemId: id,
				fields: {
					title: 'Synthetic work',
					notes,
					project: 'Harness',
					kind: 'task',
					status: 'open',
					auto: id,
					launch_source: 'manual',
					computer: primary,
					'note+': 'auto-launch requested on ' + primary
				}
			});
		},
		async tick(times = 1) {
			for (let index = 0; index < times; index++)
				await runtime.scheduler!.tick(new AbortController().signal);
		},
		started: () => start.mock.calls.map(([{ run }]) => run.item_id),
		brief: (id: string) => start.mock.calls.find(([{ run }]) => run.item_id === id)?.[2] ?? ''
	};
}
