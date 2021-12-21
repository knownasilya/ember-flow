import Component from '@glimmer/component';
// @ts-ignore
import { hbs as tpl } from 'ember-template-imports';

interface NodeArgs {}

export default class Node extends Component<NodeArgs> {
  static template = tpl`
    <div class="ember-flow__node node" ...attributes>
      {{yield}}
    </div>
  `;
}
