import Component from '@glimmer/component';
import { zoom, zoomIdentity } from 'd3-zoom';
import { select, pointer } from 'd3-selection';
import { action } from '@ember/object';

interface Args {}

export default class FlowEditorComponent extends Component<Args> {
  @action
  setupZoom(element: Element) {
    const d3ZoomInstance = zoom();
    const selection = select(element).call(d3ZoomInstance);
    const updatedTransform = zoomIdentity.translate(0, 0).scale(0);

    d3ZoomInstance.transform(selection, updatedTransform);
  }
}
