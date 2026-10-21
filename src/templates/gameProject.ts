import type { PlannedFile } from '../core/files';
import type { ProjectTemplateInput } from './project';
import { gameDocument2d } from './gameDocument2d';
import { gameDocument3d } from './gameDocument3d';
import { gameSources } from './gameSources';

export function gameFiles(input: ProjectTemplateInput, app: PlannedFile[]): PlannedFile[] {
	const dimension = input.dimension ?? '2d';
	const manifest = app.find((file) => file.path === 'package.json')!;
	const pkg = JSON.parse(manifest.contents);
	pkg.harness = { kind: 'game', dimension, aiRendering: false };
	pkg.dependencies = { three: '0.180.0', '@decartai/sdk': '0.2.12' };
	pkg.devDependencies['@types/three'] = '0.180.0';
	manifest.contents = JSON.stringify(pkg, null, '\t') + '\n';
	const formatting = app.find((file) => file.path === '.prettierrc')!;
	const style = JSON.parse(formatting.contents);
	style.overrides = [{ files: 'game.json', options: { parser: 'json-stringify' } }];
	formatting.contents = JSON.stringify(style, null, '\t') + '\n';
	const vite = app.find((file) => file.path === 'vite.config.ts')!;
	// Vite otherwise caches /game as the root game.json module after the first page load.
	vite.contents = vite.contents.replace(
		'plugins: [sveltekit()],',
		"plugins: [sveltekit()],\n\tresolve: { extensions: ['.mjs', '.js', '.mts', '.ts', '.jsx', '.tsx'] },"
	);
	return [
		...app,
		...Object.entries(gameSources).map(([path, contents]) => ({
			path: 'src/lib/game/' + path,
			contents
		})),
		{
			path: 'game.json',
			contents:
				JSON.stringify(
					JSON.parse(dimension === '3d' ? gameDocument3d : gameDocument2d),
					null,
					'\t'
				) + '\n'
		},
		{ path: 'src/routes/game/+page.svelte', contents: gamePage() },
		{
			path: 'static/game/assets/README.md',
			contents:
				'# Saved game assets\n\nGenerate textures, sprites, UI art and references with GPT Image or another chosen image model during authoring. Save selected files here and record their provider/model, prompt, license and purpose. Load them using Three.js TextureLoader, Sprite or GLTFLoader. Images are not 3D meshes: build geometry or import GLB models separately. Never call an image model in the render loop.\n'
		},
		{
			path: 'GAME.md',
			contents:
				'# Game authoring\n\nOpen this project in Harness and use Game Views to edit game.json.\n\nViews own UI and visual direction; mechanics own state/input/event contracts. Checkpoints execute structured conditions and actions. Run the /game route to play the starter. Native Three.js renders gameplay in both 2D (orthographic) and 3D (perspective). AI rendering is off by default. Generate and save art during authoring; see static/game/assets/README.md. Existing AI adapters remain available for explicitly enabled experiments.\n'
		}
	];
}
function gamePage(): string {
	return `<script lang="ts">
 import {onMount} from 'svelte';
 import document from '../../../game.json';
 import {createRun,stepGame} from '$lib/game/utils/gameStep';
 import type {GameView,GameRun} from '$lib/game/models/Game.types';
 let canvas:HTMLCanvasElement; let run=$state(createRun()); let ready=$state(false);
 const view=document.views[0] as GameView;
 let render:(run:GameRun,view:GameView)=>void;
 function move(x:number,y:number,choice?:string){run=stepGame(run,{x,y,choice},view);render?.(run,view);}
 onMount(()=>{let dispose=()=>{};let active=true;
 void import('$lib/game/utils/create3d').then(({create3d})=>{if(!active)return;const scene=create3d(canvas);render=(r,v)=>scene.render(r,v);dispose=()=>scene.dispose();render(run,view);ready=true;});
 return ()=>{active=false;dispose();};});
 </script>
 <svelte:head><title>{view.title}</title></svelte:head>
 <h1>{view.title}</h1><canvas data-ready={ready} bind:this={canvas} width="1280" height="704" style="width:100%;max-width:960px" aria-label="Game scene"></canvas>
 <p>Key: {run.state.hasKey ? 'collected':'missing'} · Door: {run.state.doorOpen ? 'open':'locked'} · Outcome: {run.state.outcome || 'exploring'}</p>
 {#each view.checkpoints.filter(node=>run.completed.includes(node.id) && node.image) as node (node.id)}
 <figure><img src={'/'+node.image!.path.replace('static/','')} alt={node.title+' gameplay reference'} style="width:100%;max-width:960px" /><figcaption>{node.title}</figcaption></figure>
 {/each}
 <button disabled={!ready} onclick={()=>move(-1,0)}>Move left</button><button disabled={!ready} onclick={()=>move(1,0)}>Move right</button>
 <button disabled={!run.state.doorOpen} onclick={()=>move(0,0,'garden')}>Garden</button><button disabled={!run.state.doorOpen} onclick={()=>move(0,0,'vault')}>Vault</button>
 `;
}
