import React from 'react';
import { render } from 'lib/testHelpers';
import { screen, fireEvent } from '@testing-library/react';
import { SchemaType } from 'generated-sources';
import SchemaToggleEditor from 'components/common/SchemaToggleEditor/SchemaToggleEditor';
import * as featureFlags from 'lib/featureFlags';

jest.mock('lib/featureFlags', () => ({
  isVisualSchemaEditorEnabled: jest.fn(),
}));

jest.mock('jsonjoy-builder', () => ({
  __esModule: true,
  JsonSchemaEditor: ({
    schema,
    setSchema,
    readOnly,
  }: {
    schema: Record<string, unknown>;
    setSchema?: (s: Record<string, unknown>) => void;
    readOnly?: boolean;
  }) => (
    <div data-testid="json-schema-editor" aria-readonly={readOnly}>
      <textarea
        data-testid="json-schema-editor-input"
        defaultValue={JSON.stringify(schema, null, 2)}
        readOnly={readOnly}
        onChange={(e) =>
          setSchema?.(JSON.parse(e.target.value) as Record<string, unknown>)
        }
      />
    </div>
  ),
}));

describe('SchemaToggleEditor', () => {
  beforeEach(() => {
    jest.mocked(featureFlags.isVisualSchemaEditorEnabled).mockReturnValue(true);
  });

  it('renders Ace editor when feature flag is off', () => {
    jest
      .mocked(featureFlags.isVisualSchemaEditorEnabled)
      .mockReturnValue(false);
    render(
      <SchemaToggleEditor
        value="{}"
        schemaType={SchemaType.JSON}
        onChange={jest.fn()}
      />
    );
    expect(screen.queryByTestId('json-schema-editor')).not.toBeInTheDocument();
  });

  it('renders Ace editor for AVRO schema type', () => {
    render(
      <SchemaToggleEditor
        value="{}"
        schemaType={SchemaType.AVRO}
        onChange={jest.fn()}
      />
    );
    expect(screen.queryByTestId('json-schema-editor')).not.toBeInTheDocument();
  });

  it('renders Ace editor for PROTOBUF schema type', () => {
    render(
      <SchemaToggleEditor
        value="{}"
        schemaType={SchemaType.PROTOBUF}
        onChange={jest.fn()}
      />
    );
    expect(screen.queryByTestId('json-schema-editor')).not.toBeInTheDocument();
  });

  it('renders JsonSchemaEditor for JSON schema type with flag on', async () => {
    render(
      <SchemaToggleEditor
        value='{"type":"object"}'
        schemaType={SchemaType.JSON}
        onChange={jest.fn()}
      />
    );
    expect(await screen.findByTestId('json-schema-editor')).toBeInTheDocument();
  });

  it('calls onChange when schema changes in visual editor', async () => {
    const onChange = jest.fn();
    render(
      <SchemaToggleEditor
        value='{"type":"object"}'
        schemaType={SchemaType.JSON}
        onChange={onChange}
      />
    );
    const input = await screen.findByTestId('json-schema-editor-input');
    fireEvent.change(input, { target: { value: '{"type":"string"}' } });
    expect(onChange).toHaveBeenCalled();
  });

  it('renders readOnly JsonSchemaEditor when readOnly=true', async () => {
    render(
      <SchemaToggleEditor
        value='{"type":"object"}'
        schemaType={SchemaType.JSON}
        readOnly
      />
    );
    const editor = await screen.findByTestId('json-schema-editor');
    expect(editor).toHaveAttribute('aria-readonly', 'true');
  });

  it('defaults to type:object schema when value is empty', async () => {
    render(
      <SchemaToggleEditor
        value=""
        schemaType={SchemaType.JSON}
        onChange={jest.fn()}
      />
    );
    const input = await screen.findByTestId('json-schema-editor-input');
    expect(input).toHaveValue(JSON.stringify({ type: 'object' }, null, 2));
  });

  it('defaults to type:object when value is invalid JSON', async () => {
    render(
      <SchemaToggleEditor
        value="not-valid-json"
        schemaType={SchemaType.JSON}
        onChange={jest.fn()}
      />
    );
    const input = await screen.findByTestId('json-schema-editor-input');
    expect(input).toHaveValue(JSON.stringify({ type: 'object' }, null, 2));
  });
});
