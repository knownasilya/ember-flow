import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
// @ts-expect-error imp
import { hbs as tpl } from 'ember-template-imports';
// @ts-expect-error imp
import didInsert from '@ember/render-modifiers/modifiers/did-insert';
import { EdgeOptions } from './flow-editor';
import { action } from '@ember/object';

// TODO: use cached once bug fixed

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
  options: EdgeOptions;
}

export default class SmoothStepEdge extends Component<SmoothStepArgs> {
  static template = tpl`
    <g>
      <path style={{@style}} className="react-flow__edge-path" d={{this.path}} markerEnd={{this.markerEnd}} />
      {{#if @options.label}}
        <EdgeText @label={{@options.label}} @x={{this.labelPosition.x}} @y={{this.labelPosition.y}} />
      {{/if}}
      {{yield}}
    </g>
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

  get labelPosition(): { x: number; y: number } {
    const [centerX, centerY] = getCenter({
      sourceX: this.args.sourceX,
      sourceY: this.args.sourceY,
      targetX: this.args.targetX,
      targetY: this.args.targetY,
      sourcePosition: this.args.sourcePosition,
      targetPosition: this.args.targetPosition,
    });
    return { x: centerX, y: centerY };
  }
}

class EdgeTextBbox {
  @tracked x = 0;
  @tracked y = 0;
  @tracked width = 0;
  @tracked height = 0;
}

class EdgeText extends Component<{ x: number; y: number }> {
  static template = tpl`
    <g transform={{this.transform}} ...attributes>
      <text class="ember-flow__edge-text" y={{this.y}} dy="0.3em" {{didInsert this.updateBbox}}>
        {{@label}}
      </text>
      {{yield}}
    </g>
  `;

  edgeTextBbox = new EdgeTextBbox();

  get transform() {
    return `translate(${this.args.x - this.edgeTextBbox.width / 2} ${
      this.args.y - this.edgeTextBbox.height / 2
    })`;
  }

  @action
  updateBbox(el: SVGTextElement) {
    const textBbox = el.getBBox();

    Object.assign(this.edgeTextBbox, {
      x: textBbox.x,
      y: textBbox.y,
      width: textBbox.width,
      height: textBbox.height,
    });
  }
}

// TODO: move to utils
// copied from react-flow https://github.com/wbkd/react-flow/blob/main/src/components/Edges/SmoothStepEdge.tsx

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
