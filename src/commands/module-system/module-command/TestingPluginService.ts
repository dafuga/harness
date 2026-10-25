import { join } from 'node:path';
import { ModuleCatalogService } from '../../../services/module-system/ModuleCatalogService';
import { ModuleInstallService } from '../../../services/module-system/ModuleInstallService';
import { resourceWork } from '../../../utils/execution-runtimes/resourceWork';
import { resourceHome } from '../../../utils/execution-runtimes/resourceConfig';
import { runIsolated } from '../../../utils/reports-media/run-isolated/runIsolated';

/** Run an installed testing plugin under shared admission and owned-process cleanup. */
export class TestingPluginService {
	async run(root: string, id: string, args: string[] = [], signal?: AbortSignal): Promise<number> {
		const catalog = await new ModuleCatalogService().load(root);
		if (catalog.gaps.length) throw new Error(catalog.gaps.join('\n'));
		const entry = catalog.modules.find((item) => item.definition.id === id);
		if (!entry?.definition.testing || !entry.installed)
			throw new Error('Install a testing plugin before running it.');
		if (args.some((arg) => /^(?:--headed|--debug|--ui|--config|-c)(?:=|$)/.test(arg)))
			throw new Error('Testing plugins require their headless configuration.');
		await new ModuleInstallService().add(root, id);
		return resourceWork(
			{
				priority: 'agent-test',
				label: `Testing plugin ${id}`,
				memoryMiB: Number(process.env.HARNESS_RESOURCE_MEMORY_MIB ?? 2048)
			},
			async (context) => {
				const result = await runIsolated({
					command: 'bun',
					signal,
					args: ['run', entry.definition.testing!.script, ...args],
					cwd: root,
					stdio: 'inherit',
					onSpawn: context.track,
					timeoutMs: 600000,
					maxLogBytes: 1000000,
					log: join(resourceHome(context.env), 'logs', context.id + '.log'),
					env: { ...context.env, PWDEBUG: '0', HEADED: '0' }
				});
				if (result.status === 'passed') return 0;
				return result.exitCode === 0 ? 1 : (result.exitCode ?? 1);
			},
			process.env,
			{ signal }
		);
	}
}
