import Component from '@glimmer/component';
import { zoom, ZoomBehavior, zoomIdentity } from 'd3-zoom';
import { BaseType, select, Selection } from 'd3-selection';
import { D3DragEvent, drag } from 'd3-drag';
import { action } from '@ember/object';
import { next, throttle } from '@ember/runloop';
import { TrackedMap, TrackedWeakMap } from 'tracked-built-ins';
// @ts-ignore
import { hbs as tpl } from 'ember-template-imports';
// @ts-ignore
import { tracked, cached } from '@glimmer/tracking';
// @ts-ignore
import didInsert from '@ember/render-modifiers/modifiers/did-insert';
// @ts-ignore
import { hash } from '@ember/helper';
import Node from './node';
// @ts-ignore
import SmoothStepEdge, { Position } from './smooth-step-edge';

interface EdgeDef {
  targetX: number;
  targetY: number;
  sourceX: number;
  sourceY: number;
  targetPosition?: Position;
  sourcePosition?: Position;
}

export class EditorApi {
  editor: FlowEditorComponent;
  ports = new TrackedWeakMap<Element, { position: Position }>();
  edges = new TrackedMap<string, Element[]>();

  constructor(editor: FlowEditorComponent) {
    this.editor = editor;
  }

  addEdgeToPort(port: Element, edgeId: string) {
    if (this.edges.has(edgeId)) {
      let ports = this.edges.get(edgeId);
      ports?.push(port);
    } else {
      this.edges.set(edgeId, [port]);
    }
  }

  addPort(element: Element, position: Position) {
    this.ports.set(element, { position });
  }

  // @cached
  get edgeIds() {
    let ids: string[] = [];

    this.edges.forEach((_, id) => ids.push(id));

    return ids;
  }

  // @cached
  get edgeMap(): EdgeDef[] {
    return this.edgeIds
      .map((edgeId) => {
        let ports = this.edges.get(edgeId);

        if (!ports || ports.length !== 2) {
          return;
        }

        let source = ports[0];
        let target = ports[1];
        let sourceOptions = this.ports.get(source);
        let targetOptions = this.ports.get(target);

        let [p1, p2] = [
          source.getBoundingClientRect(),
          target.getBoundingClientRect(),
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
          targetPosition: targetOptions?.position,
          sourcePosition: sourceOptions?.position,
        };
      })
      .filter((i) => !!i) as EdgeDef[];
  }
}

interface Args {}

export default class FlowEditorComponent extends Component<Args> {
  static template = tpl`
    <div class='canvas' {{didInsert this.setupZoom}}>
      <div class='container'>
        {{yield 
          (hash
            Node=(component this.Node editor=this.editorApi)
            addEdge=this.addEdge
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

  updateEdges() {
    let edges = this.editorApi.edgeMap;

    this.edges = edges;
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
