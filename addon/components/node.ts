import Component from '@glimmer/component';
import { next } from '@ember/runloop';
import { modifier } from 'ember-modifier';
// @ts-expect-error imp
import { fn } from '@ember/helper';
// @ts-expect-error imp
import { hash } from '@ember/helper';
// @ts-expect-error imp
import { hbs as tpl } from 'ember-template-imports';
// @ts-expect-error imp
import didInsert from '@ember/render-modifiers/modifiers/did-insert';

import { EditorApi } from './flow-editor';
import { Position } from './smooth-step-edge';

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
        (hash
          Port=(component this.Port register=this.register)
          connectEdge=this.connectEdge
        )
        to='ports'
      }}
    </div>
  `;

  Port = Port;
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
