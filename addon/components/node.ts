import { helper } from '@ember/component/helper';
import { next } from '@ember/runloop';
import Component from '@glimmer/component';
import { modifier } from 'ember-modifier';
import { fn } from '@ember/helper';
import didInsert from '@ember/render-modifiers/modifiers/did-insert';
// @ts-ignore
import { hbs as tpl } from 'ember-template-imports';
import { EditorApi, Position } from './flow-editor';

interface NodeArgs {
  editor: EditorApi;
}

const Port = tpl`<div class='handle edge-{{@position}}' ...attributes {{didInsert (fn @register @position)}}></div>`;

export default class Node extends Component<NodeArgs> {
  static template = tpl`
    <div class="ember-flow__node node" ...attributes>
      <div class="content">
        {{yield}}
      </div>

      {{yield
        (this.hash
          Port=(component this.Port register=this.register)
          connectEdge=this.connectEdge
        )
        to='ports'
      }}
    </div>
  `;

  Port = Port;
  hash = helper((_, hash) => hash);
  connectEdge = modifier((portEl, [id]: [string]) => {
    next(() => {
      this.args.editor.addEdgeToPort(portEl, id);
    });
  });
  register = (position: Position, portEl: Element) => {
    next(() => {
      this.args.editor.addPort(portEl, position);
    });
  };
}
