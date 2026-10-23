import type { FrameSource, GameRun, GameView } from '../../models/game-authoring/Game.types';

/** Native 2D canvas frame source for the player, key and gate scene. */
export class Canvas2dAdapter implements FrameSource {
	constructor(readonly canvas: HTMLCanvasElement) {}

	render = (run: GameRun, view: GameView) => draw2d(this.canvas, run, view);

	dispose = () =>
		this.canvas.getContext('2d')?.clearRect(0, 0, this.canvas.width, this.canvas.height);
}

export function create2d(canvas: HTMLCanvasElement): FrameSource {
	return new Canvas2dAdapter(canvas);
}

export function draw2d(canvas: HTMLCanvasElement, run: GameRun, view: GameView): void {
	const ctx = canvas.getContext('2d');
	if (!ctx) return;
	if (view.world) return drawLevel(ctx, canvas, run, view.world);
	const w = canvas.width,
		h = canvas.height;
	ctx.fillStyle = '#152c29';
	ctx.fillRect(0, 0, w, h);
	ctx.strokeStyle = '#28423a';
	for (let x = 0; x < w; x += w / 12) {
		ctx.beginPath();
		ctx.moveTo(x, 0);
		ctx.lineTo(x, h);
		ctx.stroke();
	}
	for (let y = 0; y < h; y += h / 8) {
		ctx.beginPath();
		ctx.moveTo(0, y);
		ctx.lineTo(w, y);
		ctx.stroke();
	}
	const ground = h * 0.6;
	ctx.fillStyle = '#476755';
	ctx.fillRect(w * 0.04, ground, w * 0.92, h * 0.2);
	ctx.fillStyle = run.state.doorOpen ? '#5e9e70' : '#c7995d';
	if (run.state['visible:door'] !== false)
		ctx.fillRect(w * 0.4, ground - h * 0.27, w * 0.04, h * 0.27);
	if (!run.state.hasKey && run.state['visible:key'] !== false) {
		ctx.fillStyle = '#f5d77d';
		ctx.beginPath();
		ctx.arc(w * 0.23, ground - h * 0.06, 9, 0, Math.PI * 2);
		ctx.fill();
		ctx.fillRect(w * 0.23, ground - h * 0.06, 24, 5);
	}
	ctx.fillStyle = '#acd8ee';
	if (run.state['visible:player'] !== false)
		ctx.fillRect(
			w * 0.06 + Number(run.state.x) * w * 0.08,
			ground - 30 - Number(run.state.y) * h * 0.03,
			22,
			30
		);
	ctx.fillStyle = '#d8e4d4';
	ctx.font = '16px sans-serif';
	ctx.fillText(view.title, 24, 32);
	canvas.dataset.ready = 'true';
}

function drawLevel(
	ctx: CanvasRenderingContext2D,
	canvas: HTMLCanvasElement,
	run: GameRun,
	world: NonNullable<GameView['world']>
) {
	const scale = Math.min(canvas.width / (world.width + 2), canvas.height / (world.depth + 2));
	const left = (canvas.width - world.width * scale) / 2,
		top = (canvas.height - world.depth * scale) / 2;
	ctx.fillStyle = '#152c29';
	ctx.fillRect(0, 0, canvas.width, canvas.height);
	ctx.fillStyle = '#476755';
	ctx.fillRect(left, top, world.width * scale, world.depth * scale);
	for (const o of world.objects) {
		ctx.fillStyle = o.kind === 'goal' ? '#f5d77d' : '#c7995d';
		ctx.fillRect(
			left + (o.x - o.width / 2) * scale,
			top + (o.z - o.depth / 2) * scale,
			o.width * scale,
			o.depth * scale
		);
	}
	ctx.fillStyle = '#acd8ee';
	ctx.fillRect(
		left + (Number(run.state.x) - 0.2) * scale,
		top + (Number(run.state.y) - 0.2) * scale,
		0.4 * scale,
		0.4 * scale
	);
	canvas.dataset.ready = 'true';
	canvas.dataset.dimension = '2d';
}
