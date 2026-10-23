import type { Point, Box } from './Software3dAdapter.types';
import type { FrameSource, GameRun, GameView } from '../../models/game-authoring/Game.types';

/** The same primitive world projected onto Canvas when WebGL is unavailable. */
export class Software3dAdapter implements FrameSource {
	private readonly ctx: CanvasRenderingContext2D;

	constructor(readonly canvas: HTMLCanvasElement) {
		const context = canvas.getContext('2d');
		if (!context) throw new Error('This browser cannot create a game canvas.');
		this.ctx = context;
	}

	render = (run: GameRun, _view: GameView) => {
		if (_view.world) return drawLevelWorld(this.canvas, this.ctx, run, _view.world);
		const { canvas, ctx } = this;
		const project = (point: Point) => projectPoint(point, canvas.width, canvas.height);
		ctx.fillStyle = '#152c29';
		ctx.fillRect(0, 0, canvas.width, canvas.height);
		face(
			ctx,
			[
				[-2, -0.1, -3.5],
				[10, -0.1, -3.5],
				[10, -0.1, 3.5],
				[-2, -0.1, 3.5]
			].map((p) => project(p as Point)),
			'#476755'
		);
		const boxes: Box[] = [
			{
				id: 'player',
				at: [Number(run.state.x), 0, Number(run.state.y)],
				size: [0.4, 0.8, 0.4],
				color: '#acd8ee'
			}
		];
		if (!run.state.hasKey && run.state['visible:key'] !== false)
			boxes.push({ id: 'key', at: [2, 0.3, 0], size: [0.35, 0.35, 0.35], color: '#f5d77d' });
		if (!run.state.doorOpen && run.state['visible:door'] !== false)
			boxes.push({ id: 'door', at: [4, 0, 0], size: [0.25, 2, 1.8], color: '#c7995d' });
		boxes.sort((a, b) => depth(b.at) - depth(a.at));
		for (const box of boxes)
			if (run.state['visible:' + box.id] !== false) drawBox(ctx, box, project);
		canvas.dataset.ready = 'true';
		canvas.dataset.renderer = 'software3d';
	};

	dispose = () => this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
}
function projectPoint(point: Point, width: number, height: number): [number, number] {
	const [x, y, z] = point;
	const q: Point = [x - 6, y - 7, z - 13],
		distance = depth([x, y, z]);
	const right = (q[0] * 13 - q[2] * 2) / Math.sqrt(173);
	const up = (-q[0] * 14 + q[1] * 173 - q[2] * 91) / Math.sqrt(173 * 222);
	const focal = height / (2 * Math.tan((48 * Math.PI) / 360));
	return [width / 2 + (right * focal) / distance, height / 2 - (up * focal) / distance];
}
function depth([x, y, z]: Point): number {
	return ((x - 6) * -2 + (y - 7) * -7 + (z - 13) * -13) / Math.sqrt(222);
}
function drawBox(
	ctx: CanvasRenderingContext2D,
	box: Box,
	project: (point: Point) => [number, number]
) {
	const [x, y, z] = box.at,
		[w, h, d] = box.size;
	const vertices: Point[] = [
		[x - w / 2, y, z - d / 2],
		[x + w / 2, y, z - d / 2],
		[x + w / 2, y, z + d / 2],
		[x - w / 2, y, z + d / 2],
		[x - w / 2, y + h, z - d / 2],
		[x + w / 2, y + h, z - d / 2],
		[x + w / 2, y + h, z + d / 2],
		[x - w / 2, y + h, z + d / 2]
	];
	for (const indices of [
		[1, 2, 6, 5],
		[2, 3, 7, 6],
		[4, 5, 6, 7]
	]) {
		face(
			ctx,
			indices.map((index) => project(vertices[index])),
			box.color
		);
	}
}
function face(ctx: CanvasRenderingContext2D, points: [number, number][], color: string): void {
	ctx.beginPath();
	ctx.moveTo(...points[0]);
	for (const point of points.slice(1)) ctx.lineTo(...point);
	ctx.closePath();
	ctx.fillStyle = color;
	ctx.fill();
	ctx.strokeStyle = '#152c2933';
	ctx.stroke();
}

function drawLevelWorld(
	canvas: HTMLCanvasElement,
	ctx: CanvasRenderingContext2D,
	run: GameRun,
	layout: NonNullable<GameView['world']>
) {
	const scale = Math.min(10 / layout.width, 6 / layout.depth);
	const project = (point: Point) =>
		projectPoint(
			[
				4 + (point[0] - layout.width / 2) * scale,
				point[1] * scale,
				(point[2] - layout.depth / 2) * scale
			],
			canvas.width,
			canvas.height
		);
	ctx.fillStyle = '#152c29';
	ctx.fillRect(0, 0, canvas.width, canvas.height);
	face(
		ctx,
		[
			[0, 0, 0],
			[layout.width, 0, 0],
			[layout.width, 0, layout.depth],
			[0, 0, layout.depth]
		].map((p) => project(p as Point)),
		'#476755'
	);
	const boxes: Box[] = layout.objects.map((o) => ({
		id: o.id,
		at: [o.x, 0, o.z],
		size: [o.width, o.height, o.depth],
		color: o.kind === 'goal' ? '#f5d77d' : '#c7995d'
	}));
	boxes.push({
		id: 'player',
		at: [Number(run.state.x), 0, Number(run.state.y)],
		size: [0.4, 0.8, 0.4],
		color: '#acd8ee'
	});
	boxes.sort((a, b) => b.at[2] - a.at[2] || a.at[0] - b.at[0]);
	for (const box of boxes) drawBox(ctx, box, project);
	canvas.dataset.ready = 'true';
	canvas.dataset.renderer = 'software3d';
	canvas.dataset.dimension = '3d';
}
