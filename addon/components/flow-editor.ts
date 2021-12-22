import Component from '@glimmer/component';
import { zoom, ZoomBehavior, zoomIdentity } from 'd3-zoom';
import { BaseType, select, Selection } from 'd3-selection';
import { D3DragEvent, drag } from 'd3-drag';
import { action } from '@ember/object';
import { next, throttle } from '@ember/runloop';
import { helper } from '@ember/component/helper';
import { TrackedMap, TrackedWeakMap } from 'tracked-built-ins';
// @ts-expect-error imp
import { hbs as tpl } from 'ember-template-imports';
import { tracked, cached } from '@glimmer/tracking';
// @ts-expect-error imp
import didInsert from '@ember/render-modifiers/modifiers/did-insert';
// @ts-expect-error imp
import { hash } from '@ember/helper';
import Node from './node';
// @ts-expect-error imp
import SmoothStepEdge, { Position } from './smooth-step-edge';

interface EdgeDef {
  targetX: number;
  targetY: number;
  sourceX: number;
  sourceY: number;
  targetPosition?: Position;
  sourcePosition?: Position;
  options?: EdgeOptions;
}

export interface EdgeOptions {
  label?: string;
}

export class EditorApi {
  editor: FlowEditorComponent;
  ports = new TrackedWeakMap<Element, { position: Position }>();
  edges = new TrackedMap<
    string,
    { ports?: Element[]; options?: EdgeOptions }
  >();

  constructor(editor: FlowEditorComponent) {
    this.editor = editor;
  }

  addEdgeToPort(port: Element, edgeId: string) {
    if (this.edges.has(edgeId)) {
      const data = this.edges.get(edgeId);

      if (data && !data.ports) {
        data.ports = [];
      }

      data?.ports?.push(port);
    } else {
      this.edges.set(edgeId, { ports: [port] });
    }
  }

  configureEdge(id: string, options: EdgeOptions): void {
    if (!this.edges.has(id)) {
      this.edges.set(id, { options });
    } else {
      const data = this.edges.get(id);

      if (!data) {
        return;
      }

      data.options = options;
    }
  }

  addPort(element: Element, position: Position) {
    this.ports.set(element, { position });
  }

  @cached
  get edgeIds(): string[] {
    const ids: string[] = [];

    this.edges.forEach((_, id) => ids.push(id));

    return ids;
  }

  // @cached
  get edgeMap(): EdgeDef[] {
    return this.edgeIds
      .map((edgeId) => {
        const data = this.edges.get(edgeId);
        const ports = data && data.ports;

        if (!data || !ports || ports.length !== 2) {
          return;
        }

        const source = ports[0];
        const target = ports[1];
        const sourceOptions = this.ports.get(source);
        const targetOptions = this.ports.get(target);

        const [p1, p2] = [
          source.getBoundingClientRect(),
          target.getBoundingClientRect(),
        ];
        const sourceX = p1.x - p1.width;
        const sourceY = p1.y - p1.height;
        const targetX = p2.x - p2.width;
        const targetY = p2.y - p2.height;

        return {
          targetX,
          targetY,
          sourceX,
          sourceY,
          targetPosition: targetOptions?.position,
          sourcePosition: sourceOptions?.position,
          options: data.options,
        };
      })
      .filter((i) => !!i) as EdgeDef[];
  }
}

export default class FlowEditorComponent extends Component {
  static template = tpl`
    <div class='canvas' {{didInsert this.setupZoom}}>
      <div class='container'>
        {{yield 
          (hash
            Node=(component this.Node editor=this.editorApi)
            configureEdge=this.configureEdge
          )
        }}

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
                @options={{edge.options}}
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

  @tracked edges?: EdgeDef[];

  editorApi = new EditorApi(this);
  Node = Node;
  configureEdge = helper(([id]: [string], options: EdgeOptions) => {
    next(() => {
      this.editorApi.configureEdge(id, options);
    });
  });

  updateEdges(): void {
    const edges = this.editorApi.edgeMap;

    this.edges = edges;
  }

  @action
  setupZoom(element: HTMLDivElement): void {
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
            const { x, y, k } = transform;
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
          const selected = select(this);

          selected.raise();
          selected.style('cursor', 'grabbing');
        })
        .on('drag', (event: D3DragEvent<HTMLDivElement, unknown, unknown>) => {
          const selected = select(event.sourceEvent.target);
          const top = Number(selected.style('top').replace('px', ''));
          const left = Number(selected.style('left').replace('px', ''));

          selected.style('top', top + event.dy + 'px');
          selected.style('left', left + event.dx + 'px');
          // update the edge
          this.updateEdges();
        })
        .on('end', function () {
          const selected = select(this);

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
  resetScale(): void {
    const updatedTransform = zoomIdentity.scale(1);

    if (this.selection) {
      this.d3ZoomInstance?.transform(this.selection, updatedTransform);
    }
  }
}
