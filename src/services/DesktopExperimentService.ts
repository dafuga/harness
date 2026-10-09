import { createHash } from 'node:crypto';
import { desktopPatchConfig } from '../config/desktopPatchConfig';

export class DesktopExperimentService {
	plan(
		sources: Map<string, string>,
		options: { dataPath: string; catalogPath: string }
	): Map<string, string> {
		this.verifySources(sources);
		const result = new Map(sources);
		const keys = Object.keys(desktopPatchConfig.assets);
		const boot = keys[0],
			bootstrap = keys[1],
			network = keys[2],
			shared = keys[3],
			ui = keys[4];
		const environment = `process.env.CODEX_SPARKLE_ENABLED="false";process.env.CODEX_APP_SERVER_FORCE_CLI="1";process.env.CODEX_ELECTRON_USER_DATA_PATH=${JSON.stringify(options.dataPath)};`;
		result.set(boot, environment + sources.get(boot)!);
		result.set(
			bootstrap,
			replaceOnce(
				sources.get(bootstrap)!,
				'p.app.setName(r.Rt(Q9))',
				'p.app.setName("Codex Harness Experimental")'
			)
		);
		result.set(
			network,
			replaceOnce(
				sources.get(network)!,
				'args:[...r.args,...t.flatMap',
				'args:[...r.args,"-c","thread_unload_delay_secs=1",...t.flatMap'
			)
		);
		result.set(shared, this.patchClient(sources.get(shared)!, options.catalogPath));
		result.set(ui, this.patchRemote(this.patchFilter(sources.get(ui)!)));
		return result;
	}

	private verifySources(sources: Map<string, string>): void {
		for (const [path, hash] of Object.entries(desktopPatchConfig.assets)) {
			const source = sources.get(path);
			if (!source || createHash('sha256').update(source).digest('hex') !== hash)
				throw new Error(`Unsupported desktop build: ${path}`);
		}
	}

	private patchFilter(source: string): string {
		const anchor = 'model:o,useHiddenModels:s}){';
		return replaceOnce(
			source,
			anchor,
			anchor + 'if(o.model==="claude-opus-5-5"&&!o.hidden)return true;'
		);
	}

	private patchRemote(source: string): string {
		const ephemeral = replaceOnce(
			source,
			'sendRequest(n?`remoteControl/enable`:`remoteControl/disable`,null)',
			'sendRequest(n?`remoteControl/enable`:`remoteControl/disable`,{ephemeral:true})'
		);
		return replaceOnce(ephemeral, 'r=()=>{n!=null&&j9s(t,n).catch', 'r=()=>{j9s(t,false).catch');
	}

	private patchClient(source: string, catalogPath: string): string {
		let client =
			'import {NativePickerBridgeService as HarnessPickerBridge} from "./harness-native-picker.js";\n' +
			source;
		const bridge = `this.harnessNativePicker??=new HarnessPickerBridge((m,p,o)=>this.enqueueRequest(m,p,o),${JSON.stringify(catalogPath)});return this.harnessNativePicker.send(e,t,n);`;
		const requestAnchor = 'async sendRequest(e,t,n){if(this.dispatchMessage==null)';
		client = replaceOnce(
			client,
			requestAnchor,
			`async sendRequest(e,t,n){if((this.hostId==="local"||mN(this.hostId))&&["config/read","config/batchWrite","model/list","thread/list","thread/start","thread/resume","thread/settings/update","turn/start"].includes(e)){${bridge}}if(this.dispatchMessage==null)`
		);
		client = replaceOnce(
			client,
			'async prewarmThreadStart(e,t){',
			'async prewarmThreadStart(e,t){return this.sendRequest("thread/start",e,t);'
		);
		return client;
	}
}

export function replaceOnce(source: string, anchor: string, replacement: string): string {
	if (source.split(anchor).length !== 2)
		throw new Error('Desktop patch anchor must appear exactly once');
	return source.replace(anchor, replacement);
}
