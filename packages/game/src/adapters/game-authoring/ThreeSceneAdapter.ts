import * as THREE from 'three';
import { Software3dAdapter } from './Software3dAdapter';
import type { FrameSource, GameRun, GameView } from '../../models/game-authoring/Game.types';

/** Native Three.js frame source showing one world through a flat or perspective camera. */
export class ThreeSceneAdapter implements FrameSource {
	private readonly renderer: THREE.WebGLRenderer;
	private readonly scene: THREE.Scene;
	private readonly flat: THREE.OrthographicCamera;
	private readonly camera: THREE.PerspectiveCamera;
	private readonly player: THREE.Mesh;
	private readonly door: THREE.Mesh;
	private readonly key: THREE.Mesh;

	constructor(
		readonly canvas: HTMLCanvasElement,
		context: WebGL2RenderingContext
	) {
		this.renderer = new THREE.WebGLRenderer({ canvas, context, antialias: true });
		canvas.dataset.renderer = 'webgl3d';
		this.renderer.setSize(canvas.width, canvas.height, false);
		this.renderer.setClearColor('#152c29');
		const scene = (this.scene = new THREE.Scene());
		this.flat = flatCamera(canvas.width / canvas.height);
		this.camera = new THREE.PerspectiveCamera(48, canvas.width / canvas.height, 0.1, 100);
		this.camera.position.set(6, 7, 13);
		this.camera.lookAt(4, 0, 0);
		scene.add(new THREE.AmbientLight('#ffffff', 2));
		const light = new THREE.DirectionalLight('#ffe0aa', 3);
		light.position.set(5, 8, 5);
		scene.add(light);
		const ground = box(12, 0.2, 7, '#476755');
		ground.position.set(4, -0.2, 0);
		scene.add(ground);
		scene.add((this.player = box(0.4, 0.8, 0.4, '#acd8ee')));
		this.door = box(0.25, 2, 1.8, '#c7995d');
		this.door.position.set(4, 1, 0);
		scene.add(this.door);
		this.key = box(0.35, 0.35, 0.35, '#f5d77d');
		this.key.position.set(2, 0.5, 0);
		scene.add(this.key);
	}

	render = (run: GameRun, view: GameView) => {
		this.player.position.set(Number(run.state.x), 0.4, Number(run.state.y));
		this.key.visible = !run.state.hasKey && run.state['visible:key'] !== false;
		this.door.visible = !run.state.doorOpen && run.state['visible:door'] !== false;
		this.player.visible = run.state['visible:player'] !== false;
		this.renderer.render(this.scene, view.dimension === '2d' ? this.flat : this.camera);
		this.canvas.dataset.dimension = view.dimension;
		this.canvas.dataset.ready = 'true';
	};

	dispose = () => {
		this.scene.traverse((object) => {
			if (object instanceof THREE.Mesh) {
				object.geometry.dispose();
				object.material.dispose();
			}
		});
		this.renderer.dispose();
	};
}

/** The native 3D frame source, or the software projection when WebGL is unavailable. */
export function create3d(canvas: HTMLCanvasElement): FrameSource {
	const context = canvas.getContext('webgl2', { antialias: true });
	if (!context) return new Software3dAdapter(canvas);
	return new ThreeSceneAdapter(canvas, context);
}

function box(x: number, y: number, z: number, color: string) {
	return new THREE.Mesh(new THREE.BoxGeometry(x, y, z), new THREE.MeshStandardMaterial({ color }));
}

function flatCamera(aspect: number) {
	const camera = new THREE.OrthographicCamera(-4.5 * aspect, 4.5 * aspect, 4.5, -4.5, 0.1, 100);
	camera.position.set(4, 12, 0);
	camera.up.set(0, 0, -1);
	camera.lookAt(4, 0, 0);
	return camera;
}
