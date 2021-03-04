import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render } from '@ember/test-helpers';
import { hbs } from 'ember-cli-htmlbars';

module('Integration | Component | flow-editor', function (hooks) {
  setupRenderingTest(hooks);

  test('it renders', async function (assert) {
    // Set any properties with this.set('myProperty', 'value');
    // Handle any actions with this.set('myAction', function(val) { ... });

    await render(hbs`<FlowEditor />`);

    assert.dom(this.element).containsText('');

    // Template block usage:
    await render(hbs`
      <FlowEditor>
        template block text
      </FlowEditor>
    `);

    assert.dom(this.element).containsText('template block text');
  });
});
