import Component from '@glimmer/component';
import { zoom, zoomIdentity } from 'd3-zoom';
import { select, pointer } from 'd3-selection';
import { action } from '@ember/object';
import { throttle } from '@ember/runloop';

interface Args {}

export default class FlowEditorComponent extends Component<Args> {
  @action
  setupZoom(element: HTMLDivElement) {
    const d3ZoomInstance = zoom<HTMLDivElement, unknown>();
    const selection = select(element).call(d3ZoomInstance);
    const children = selection.selectChildren('div');
    // const updatedTransform = zoomIdentity.scale(2).translate(1, -3);
    // const children = [...element.children] as HTMLDivElement[];

    selection.call(
      d3ZoomInstance
        .extent([
          [0, 0],
          [400, 400],
        ])
        .scaleExtent([1, 8])
        .on('zoom', ({ transform }) => {
          throttle(() => {
            let { x, y, k } = transform;
            children.style('transform', `translate(${x}px,${y}px) scale(${k})`);
          }, 300);
        })
    );

    // later(() => d3ZoomInstance.scaleBy(selection, 2, [2, -2]), 1000);
  }
}
