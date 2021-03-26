import Component from '@glimmer/component';
import { zoom, ZoomBehavior, zoomIdentity } from 'd3-zoom';
import { select } from 'd3-selection';
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
import { getArrow } from 'perfect-arrows';

interface Args {}

export default class FlowEditorComponent extends Component<Args> {
  d3ZoomInstance?: ZoomBehavior<HTMLDivElement, unknown>;

  @tracked edgeMap: { [key: string]: Element[] } = {};
  addEdge = modifier((element, [id]: [string]) => {
    next(() => {
      if (this.edgeMap[id]) {
        this.edgeMap[id].push(element);
      } else {
        this.edgeMap[id] = [element];
      }
      this.edgeMap = this.edgeMap;
    });
  });

  didInsert = didInsert;
  hash = helper((_, hash) => hash);
  log = helper((value) => console.log(value));

  static template = tpl`
    <div class='canvas' {{this.didInsert this.setupZoom}}>
      <div class='container'>
        {{yield (this.hash nodeClass='ember-flow__node' addEdge=this.addEdge)}}
      </div>
    </div>

    {{#if this.edges}}
      <svg
        viewBox="0 0 400 400"
        style="width: 400px; height: 400px"
        stroke="#000"
        fill="#000"
        strokeWidth="3"
      >
        {{#each this.edges as |edge|}}
          <path d={{edge.d}} fill="none" />
        {{/each}}
      </svg>
    {{/if}}
  `;

  get edges() {
    return Object.keys(this.edgeMap).map((key) => {
      let elements = this.edgeMap[key];

      if (elements.length === 2) {
        let [p1, p2] = elements.map((el) => el.getBoundingClientRect());
        const arrow = getArrow(
          p1.x - p1.width,
          p1.y - p1.height,
          p2.x - p2.width,
          p2.y - p2.height
        );
        const [sx, sy, cx, cy, ex, ey] = arrow;

        return {
          d: `M${sx},${sy} Q${cx},${cy} ${ex},${ey}`,
        };
      }
    });
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
          this.edges;
        })
        .on('end', function () {
          let selected = select(this);

          selected.style('cursor', 'grab');
        })
    );

    this.d3ZoomInstance = d3ZoomInstance;
  }
}
