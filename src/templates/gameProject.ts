import type { PlannedFile } from '../core/files';
import type { ProjectTemplateInput } from './project';
import { gameDocument2d } from './gameDocument2d';
import { gameDocument3d } from './gameDocument3d';
import { gameSources } from './gameSources';

export function gameFiles(input: ProjectTemplateInput, app: PlannedFile[]): PlannedFile[] {
	const dimension = input.dimension ?? '2d';
	const manifest = app.find((file) => file.path === 'package.json')!;
	const pkg = JSON.parse(manifest.contents);
	pkg.harness = { kind: 'game', dimension };
	pkg.dependencies = { three: '0.180.0', '@decartai/sdk': '0.2.12' };
	pkg.devDependencies['@types/three'] = '0.180.0';
	manifest.contents = JSON.stringify(pkg, null, '\t') + '\n';
	return [
		...app,
		...Object.entries(gameSources).map(([path, contents]) => ({
			path: 'src/lib/game/' + path,
			contents
		})),
		{ path: 'game.json', contents: dimension === '3d' ? gameDocument3d : gameDocument2d },
		{ path: 'src/routes/game/+page.svelte', contents: gamePage() },
		{
			path: 'GAME.md',
			contents:
				'# Game authoring\n\nOpen this project in Harness and use Game Views to edit game.json.\n\nViews own UI and visual direction; mechanics own state/input/event contracts. Checkpoints execute structured conditions and actions. Run the /game route to play the starter. Live AI preview is disabled pending a credential-safe transport and a project-owned provider credential.\n'
		}
	];
}
function gamePage(): string {
	return `<script lang="ts">
 import {onMount} from 'svelte';
 import document from '../../../game.json';
 import {createRun,stepGame} from '$lib/game/utils/gameStep';
 import {draw2d} from '$lib/game/utils/draw2d';
 import type {GameView,GameRun} from '$lib/game/models/Game.types';
 let canvas:HTMLCanvasElement; let run=$state(createRun());
 const view=document.views[0] as GameView;
 let render:(run:GameRun,view:GameView)=>void;
 function move(x:number,y:number,choice?:string){run=stepGame(run,{x,y,choice},view);render?.(run,view);}
 onMount(()=>{let dispose=()=>{};let active=true;
 if(view.dimension==='3d') void import('$lib/game/utils/create3d').then(({create3d})=>{if(!active)return;const scene=create3d(canvas);render=(r,v)=>scene.render(r,v);dispose=()=>scene.dispose();render(run,view);});
 else {render=(r,v)=>draw2d(canvas,r,v);render(run,view);}
 return ()=>{active=false;dispose();};});
 </script>
 <svelte:head><title>{view.title}</title></svelte:head>
 <h1>{view.title}</h1><canvas bind:this={canvas} width="1280" height="704" style="width:100%;max-width:960px" aria-label="Game scene"></canvas>
 <p>Key: {run.state.hasKey ? 'collected':'missing'} · Door: {run.state.doorOpen ? 'open':'locked'} · Outcome: {run.state.outcome || 'exploring'}</p>
 <button onclick={()=>move(-1,0)}>Move left</button><button onclick={()=>move(1,0)}>Move right</button>
 <button disabled={!run.state.doorOpen} onclick={()=>move(0,0,'garden')}>Garden</button><button disabled={!run.state.doorOpen} onclick={()=>move(0,0,'vault')}>Vault</button>
 `;
}
