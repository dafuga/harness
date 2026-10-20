import * as THREE from 'three';
import { software3d } from './software3d';
import type { GameRun, GameView } from '../models/Game.types';

export function create3d(canvas: HTMLCanvasElement) {
	const context = canvas.getContext('webgl2', { antialias: true });
	if (!context) return software3d(canvas);
	const renderer = new THREE.WebGLRenderer({ canvas, context, antialias: true });
	canvas.dataset.renderer = 'webgl3d';
	renderer.setSize(canvas.width, canvas.height, false);
	renderer.setClearColor('#152c29');
	const scene = new THREE.Scene();
	const camera = new THREE.PerspectiveCamera(48, canvas.width / canvas.height, 0.1, 100);
	camera.position.set(6, 7, 13);
	camera.lookAt(4, 0, 0);
	scene.add(new THREE.AmbientLight('#ffffff', 2));
	const light = new THREE.DirectionalLight('#ffe0aa', 3);
	light.position.set(5, 8, 5);
	scene.add(light);
	const ground = box(12, 0.2, 7, '#476755');
	ground.position.set(4, -0.2, 0);
	scene.add(ground);
	const player = box(0.4, 0.8, 0.4, '#acd8ee');
	scene.add(player);
	const door = box(0.25, 2, 1.8, '#c7995d');
	door.position.set(4, 1, 0);
	scene.add(door);
	const key = box(0.35, 0.35, 0.35, '#f5d77d');
	key.position.set(2, 0.5, 0);
	scene.add(key);
	return {
		canvas,
		render(run: GameRun, _view: GameView) {
			player.position.set(Number(run.state.x), 0.4, Number(run.state.y));
			key.visible = !run.state.hasKey && run.state['visible:key'] !== false;
			door.visible = !run.state.doorOpen && run.state['visible:door'] !== false;
			player.visible = run.state['visible:player'] !== false;
			renderer.render(scene, camera);
			canvas.dataset.ready = 'true';
		},
		dispose() {
			scene.traverse((object) => {
				if (object instanceof THREE.Mesh) {
					object.geometry.dispose();
					object.material.dispose();
				}
			});
			renderer.dispose();
		}
	};
}

function box(x: number, y: number, z: number, color: string) {
	return new THREE.Mesh(new THREE.BoxGeometry(x, y, z), new THREE.MeshStandardMaterial({ color }));
}
