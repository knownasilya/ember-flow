import Component from '@glimmer/component';
import { zoom, ZoomBehavior, zoomIdentity } from 'd3-zoom';
import { BaseType, select, Selection } from 'd3-selection';
import { D3DragEvent, drag } from 'd3-drag';
import { action } from '@ember/object';
import { next, throttle } from '@ember/runloop';
// @ts-ignore
import { hbs as tpl } from 'ember-template-imports';
import { modifier } from 'ember-modifier';
import { tracked } from '@glimmer/tracking';
// @ts-ignore
import didInsert from '@ember/render-modifiers/modifiers/did-insert';
import { helper } from '@ember/component/helper';

interface Args {}

export default class FlowEditorComponent extends Component<Args> {
  static template = tpl`
    <div class='canvas' {{this.didInsert this.setupZoom}}>
      <div class='container'>
        {{yield (this.hash nodeClass='ember-flow__node' addEdge=this.addEdge)}}

        {{#if this.edges}}
          <svg
            viewBox="0 0 400 400"
            style="width: 400px; height: 400px"
            stroke="#000"
            fill="none"
            strokeWidth="3"
          >
            {{#each this.edges as |edge|}}
              <SmoothStepEdge
                @sourceX={{edge.sourceX}}
                @sourceY={{edge.sourceY}}
                @targetX={{edge.targetX}}
                @targetY={{edge.targetY}}
                @targetPosition={{edge.targetPosition}}
                @sourcePosition={{edge.sourcePosition}}
              />
            {{/each}}
          </svg>
        {{/if}}
      </div>
    </div>

    <button onclick={{this.resetScale}}>Reset Zoom</button>
  `;

  d3ZoomInstance?: ZoomBehavior<HTMLDivElement, unknown>;
  selection?: Selection<HTMLDivElement, unknown, BaseType, unknown>;

  @tracked edgeMap: {
    [key: string]: {
      source: { element: Element; position?: Position };
      target?: { element: Element; position?: Position };
    };
  } = {};
  @tracked edges?: {
    targetX: number;
    targetY: number;
    sourceX: number;
    sourceY: number;
  }[];

  addEdge = modifier(
    (element, [id]: [string], { position }: { position?: Position } = {}) => {
      next(() => {
        if (this.edgeMap[id]) {
          this.edgeMap[id].target = {
            element,
            position,
          };
        } else {
          this.edgeMap[id] = { source: { element, position } };
        }
        this.edgeMap = this.edgeMap;
      });
    }
  );

  didInsert = didInsert;
  hash = helper((_, hash) => hash);
  log = helper((value) => console.log(value));

  updateEdges() {
    let edges = Object.keys(this.edgeMap)
      .map((key) => {
        let entry = this.edgeMap[key];

        if (entry && entry.source && entry.target) {
          let [p1, p2] = [
            entry.source.element.getBoundingClientRect(),
            entry.target.element.getBoundingClientRect(),
          ];
          let sourceX = p1.x - p1.width;
          let sourceY = p1.y - p1.height;
          let targetX = p2.x - p2.width;
          let targetY = p2.y - p2.height;

          return {
            targetX,
            targetY,
            sourceX,
            sourceY,
            targetPosition: entry.target?.position,
            sourcePosition: entry.source.position,
          };
        }

        return;
      })
      .filter((i) => {
        return i !== undefined;
      });

    this.edges = edges as {
      targetX: number;
      targetY: number;
      sourceX: number;
      sourceY: number;
    }[];
  }

  @action
  setupZoom(element: HTMLDivElement) {
    const d3DragInstance = drag<HTMLDivElement, unknown, unknown>();
    const d3ZoomInstance = zoom<HTMLDivElement, unknown>();
    const selection = select(element).call(d3ZoomInstance);
    const container = selection.select('.container');
    const nodes = container.selectChildren('div');
    const updatedTransform = zoomIdentity.scale(1);
    // const children = [...element.children] as HTMLDivElement[];

    d3ZoomInstance.transform(selection, updatedTransform);

    selection.call(
      d3ZoomInstance
        .extent([
          [0, 0],
          [400, 400],
        ])
        .scaleExtent([0, 8])
        .on('zoom', ({ transform }) => {
          throttle(() => {
            let { x, y, k } = transform;
            container.style(
              'transform',
              `translate(${x}px,${y}px) scale(${k})`
            );
          }, 250);
        })
    );

    nodes.call(
      d3DragInstance
        .on('start', function () {
          let selected = select(this);

          selected.raise();
          selected.style('cursor', 'grabbing');
        })
        .on('drag', (event: D3DragEvent<HTMLDivElement, unknown, unknown>) => {
          let selected = select(event.sourceEvent.target);
          let top = Number(selected.style('top').replace('px', ''));
          let left = Number(selected.style('left').replace('px', ''));

          selected.style('top', top + event.dy + 'px');
          selected.style('left', left + event.dx + 'px');
          // update the edge
          this.updateEdges();
        })
        .on('end', function () {
          let selected = select(this);

          selected.style('cursor', 'grab');
        })
    );

    this.d3ZoomInstance = d3ZoomInstance;
    this.selection = selection;

    next(() => {
      this.updateEdges();
    });
  }

  @action
  resetScale() {
    const updatedTransform = zoomIdentity.scale(1);

    if (this.selection) {
      this.d3ZoomInstance?.transform(this.selection, updatedTransform);
    }
  }
}

// TODO: copied from react-flow https://github.com/wbkd/react-flow/blob/main/src/components/Edges/SmoothStepEdge.tsx

// These are some helper methods for drawing the round corners
// The name indicates the direction of the path. "bottomLeftCorner" goes
// from bottom to the left and "leftBottomCorner" goes from left to the bottom.
// We have to consider the direction of the paths because of the animated lines.
const bottomLeftCorner = (x: number, y: number, size: number): string =>
  `L ${x},${y - size}Q ${x},${y} ${x + size},${y}`;
const leftBottomCorner = (x: number, y: number, size: number): string =>
  `L ${x + size},${y}Q ${x},${y} ${x},${y - size}`;
const bottomRightCorner = (x: number, y: number, size: number): string =>
  `L ${x},${y - size}Q ${x},${y} ${x - size},${y}`;
const rightBottomCorner = (x: number, y: number, size: number): string =>
  `L ${x - size},${y}Q ${x},${y} ${x},${y - size}`;
const leftTopCorner = (x: number, y: number, size: number): string =>
  `L ${x + size},${y}Q ${x},${y} ${x},${y + size}`;
const topLeftCorner = (x: number, y: number, size: number): string =>
  `L ${x},${y + size}Q ${x},${y} ${x + size},${y}`;
const topRightCorner = (x: number, y: number, size: number): string =>
  `L ${x},${y + size}Q ${x},${y} ${x - size},${y}`;
const rightTopCorner = (x: number, y: number, size: number): string =>
  `L ${x - size},${y}Q ${x},${y} ${x},${y + size}`;

export enum ArrowHeadType {
  Arrow = 'arrow',
  ArrowClosed = 'arrowclosed',
}

export const getMarkerEnd = (
  arrowHeadType?: ArrowHeadType,
  markerEndId?: string
): string => {
  if (typeof markerEndId !== 'undefined' && markerEndId) {
    return `url(#${markerEndId})`;
  }

  return typeof arrowHeadType !== 'undefined'
    ? `url(#react-flow__${arrowHeadType})`
    : 'none';
};

interface GetSmoothStepPathParams {
  sourceX: number;
  sourceY: number;
  sourcePosition?: Position;
  targetX: number;
  targetY: number;
  targetPosition?: Position;
  borderRadius?: number;
  centerX?: number;
  centerY?: number;
}

export enum Position {
  Left = 'left',
  Top = 'top',
  Right = 'right',
  Bottom = 'bottom',
}

export function getSmoothStepPath({
  sourceX,
  sourceY,
  sourcePosition = Position.Bottom,
  targetX,
  targetY,
  targetPosition = Position.Top,
  borderRadius = 5,
  centerX,
  centerY,
}: GetSmoothStepPathParams): string {
  const [_centerX, _centerY, offsetX, offsetY] = getCenter({
    sourceX,
    sourceY,
    targetX,
    targetY,
  });
  const cornerWidth = Math.min(borderRadius, Math.abs(targetX - sourceX));
  const cornerHeight = Math.min(borderRadius, Math.abs(targetY - sourceY));
  const cornerSize = Math.min(cornerWidth, cornerHeight, offsetX, offsetY);
  const leftAndRight = [Position.Left, Position.Right];
  const cX = typeof centerX !== 'undefined' ? centerX : _centerX;
  const cY = typeof centerY !== 'undefined' ? centerY : _centerY;

  let firstCornerPath = null;
  let secondCornerPath = null;

  if (sourceX <= targetX) {
    firstCornerPath =
      sourceY <= targetY
        ? bottomLeftCorner(sourceX, cY, cornerSize)
        : topLeftCorner(sourceX, cY, cornerSize);
    secondCornerPath =
      sourceY <= targetY
        ? rightTopCorner(targetX, cY, cornerSize)
        : rightBottomCorner(targetX, cY, cornerSize);
  } else {
    firstCornerPath =
      sourceY < targetY
        ? bottomRightCorner(sourceX, cY, cornerSize)
        : topRightCorner(sourceX, cY, cornerSize);
    secondCornerPath =
      sourceY < targetY
        ? leftTopCorner(targetX, cY, cornerSize)
        : leftBottomCorner(targetX, cY, cornerSize);
  }

  if (
    leftAndRight.includes(sourcePosition) &&
    leftAndRight.includes(targetPosition)
  ) {
    if (sourceX <= targetX) {
      firstCornerPath =
        sourceY <= targetY
          ? rightTopCorner(cX, sourceY, cornerSize)
          : rightBottomCorner(cX, sourceY, cornerSize);
      secondCornerPath =
        sourceY <= targetY
          ? bottomLeftCorner(cX, targetY, cornerSize)
          : topLeftCorner(cX, targetY, cornerSize);
    } else if (
      (sourcePosition === Position.Right && targetPosition === Position.Left) ||
      (sourcePosition === Position.Left && targetPosition === Position.Right) ||
      (sourcePosition === Position.Left && targetPosition === Position.Left)
    ) {
      // and sourceX > targetX
      firstCornerPath =
        sourceY <= targetY
          ? leftTopCorner(cX, sourceY, cornerSize)
          : leftBottomCorner(cX, sourceY, cornerSize);
      secondCornerPath =
        sourceY <= targetY
          ? bottomRightCorner(cX, targetY, cornerSize)
          : topRightCorner(cX, targetY, cornerSize);
    }
  } else if (
    leftAndRight.includes(sourcePosition) &&
    !leftAndRight.includes(targetPosition)
  ) {
    if (sourceX <= targetX) {
      firstCornerPath =
        sourceY <= targetY
          ? rightTopCorner(targetX, sourceY, cornerSize)
          : rightBottomCorner(targetX, sourceY, cornerSize);
    } else {
      firstCornerPath =
        sourceY <= targetY
          ? leftTopCorner(targetX, sourceY, cornerSize)
          : leftBottomCorner(targetX, sourceY, cornerSize);
    }
    secondCornerPath = '';
  } else if (
    !leftAndRight.includes(sourcePosition) &&
    leftAndRight.includes(targetPosition)
  ) {
    if (sourceX <= targetX) {
      firstCornerPath =
        sourceY <= targetY
          ? bottomLeftCorner(sourceX, targetY, cornerSize)
          : topLeftCorner(sourceX, targetY, cornerSize);
    } else {
      firstCornerPath =
        sourceY <= targetY
          ? bottomRightCorner(sourceX, targetY, cornerSize)
          : topRightCorner(sourceX, targetY, cornerSize);
    }
    secondCornerPath = '';
  }

  return `M ${sourceX},${sourceY}${firstCornerPath}${secondCornerPath}L ${targetX},${targetY}`;
}

export interface GetCenterParams {
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  sourcePosition?: Position;
  targetPosition?: Position;
}

const LeftOrRight = [Position.Left, Position.Right];

export const getCenter = ({
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition = Position.Bottom,
  targetPosition = Position.Top,
}: GetCenterParams): [number, number, number, number] => {
  const sourceIsLeftOrRight = LeftOrRight.includes(sourcePosition);
  const targetIsLeftOrRight = LeftOrRight.includes(targetPosition);

  // we expect flows to be horizontal or vertical (all handles left or right respectively top or bottom)
  // a mixed edge is when one the source is on the left and the target is on the top for example.
  const mixedEdge =
    (sourceIsLeftOrRight && !targetIsLeftOrRight) ||
    (targetIsLeftOrRight && !sourceIsLeftOrRight);

  if (mixedEdge) {
    const xOffset = sourceIsLeftOrRight ? Math.abs(targetX - sourceX) : 0;
    const centerX = sourceX > targetX ? sourceX - xOffset : sourceX + xOffset;

    const yOffset = sourceIsLeftOrRight ? 0 : Math.abs(targetY - sourceY);
    const centerY = sourceY < targetY ? sourceY + yOffset : sourceY - yOffset;

    return [centerX, centerY, xOffset, yOffset];
  }

  const xOffset = Math.abs(targetX - sourceX) / 2;
  const centerX = targetX < sourceX ? targetX + xOffset : targetX - xOffset;

  const yOffset = Math.abs(targetY - sourceY) / 2;
  const centerY = targetY < sourceY ? targetY + yOffset : targetY - yOffset;

  return [centerX, centerY, xOffset, yOffset];
};

interface SmoothStepArgs {
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  sourcePosition?: Position;
  targetPosition?: Position;
  arrowHeadType?: ArrowHeadType;
  markerEndId?: string;
  borderRadius?: number;
}

class SmoothStepEdge extends Component<SmoothStepArgs> {
  static template = tpl`
    <path style={{@style}} className="react-flow__edge-path" d={{this.path}} markerEnd={{this.markerEnd}} />
    {{yield}}
  `;

  get markerEnd() {
    return getMarkerEnd(this.args.arrowHeadType, this.args.markerEndId);
  }

  get path() {
    const path = getSmoothStepPath({
      sourceX: this.args.sourceX,
      sourceY: this.args.sourceY,
      sourcePosition: this.args.sourcePosition ?? Position.Bottom,
      targetX: this.args.targetX,
      targetY: this.args.targetY,
      targetPosition: this.args.targetPosition ?? Position.Top,
      borderRadius: this.args.borderRadius ?? 5,
    });

    return path;
  }
}
