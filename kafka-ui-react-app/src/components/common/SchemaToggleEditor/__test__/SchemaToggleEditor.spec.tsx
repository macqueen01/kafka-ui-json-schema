import React from 'react';
import { render } from 'lib/testHelpers';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { SchemaType } from 'generated-sources';
import SchemaToggleEditor from 'components/common/SchemaToggleEditor/SchemaToggleEditor';
import * as featureFlags from 'lib/featureFlags';

jest.mock('lib/featureFlags', () => ({
  isVisualSchemaEditorEnabled: jest.fn(),
}));

jest.mock('jsonjoy-builder', () => ({
  __esModule: true,
  SchemaVisualEditor: ({
    schema,
    onChange,
  }: {
    schema: Record<string, unknown>;
    onChange?: (s: Record<string, unknown>) => void;
    readOnly?: boolean;
  }) => (
    <div data-testid="schema-visual-editor">
      <textarea
        data-testid="schema-visual-editor-input"
        defaultValue={JSON.stringify(schema, null, 2)}
        onChange={(e) => {
          try {
            onChange?.(JSON.parse(e.target.value));
          } catch {
            // noop
          }
        }}
      />
    </div>
  ),
}));

const validJsonSchema =
  '{"type":"object","properties":{"name":{"type":"string"}}}';
const invalidJson = '{ invalid json }';

describe('SchemaToggleEditor', () => {
  beforeEach(() => {
    jest.mocked(featureFlags.isVisualSchemaEditorEnabled).mockReturnValue(true);
  });

  it('renders Ace editor only when feature flag is off', () => {
    jest
      .spyOn(featureFlags, 'isVisualSchemaEditorEnabled')
      .mockReturnValue(false);
    render(
      <SchemaToggleEditor
        value={validJsonSchema}
        onChange={jest.fn()}
        schemaType={SchemaType.JSON}
      />
    );
    expect(screen.queryByText('Visual')).not.toBeInTheDocument();
    expect(screen.queryByText('Code')).not.toBeInTheDocument();
  });

  it('renders Ace editor only for AVRO schema type', () => {
    render(
      <SchemaToggleEditor
        value=""
        onChange={jest.fn()}
        schemaType={SchemaType.AVRO}
      />
    );
    expect(screen.queryByText('Visual')).not.toBeInTheDocument();
    expect(screen.queryByText('Code')).not.toBeInTheDocument();
  });

  it('renders toggle tabs for JSON schema type with flag on', () => {
    render(
      <SchemaToggleEditor
        value={validJsonSchema}
        onChange={jest.fn()}
        schemaType={SchemaType.JSON}
      />
    );
    expect(screen.getByText('Visual')).toBeInTheDocument();
    expect(screen.getByText('Code')).toBeInTheDocument();
  });

  it('defaults to Code tab — visual editor not shown', () => {
    render(
      <SchemaToggleEditor
        value={validJsonSchema}
        onChange={jest.fn()}
        schemaType={SchemaType.JSON}
      />
    );
    expect(
      screen.queryByTestId('schema-visual-editor')
    ).not.toBeInTheDocument();
  });

  it('switches to Visual tab on valid JSON', async () => {
    render(
      <SchemaToggleEditor
        value={validJsonSchema}
        onChange={jest.fn()}
        schemaType={SchemaType.JSON}
      />
    );
    fireEvent.click(screen.getByText('Visual'));
    await waitFor(() => {
      expect(screen.getByTestId('schema-visual-editor')).toBeInTheDocument();
    });
  });

  it('shows error and stays on Code tab when JSON is invalid', () => {
    render(
      <SchemaToggleEditor
        value={invalidJson}
        onChange={jest.fn()}
        schemaType={SchemaType.JSON}
      />
    );
    fireEvent.click(screen.getByText('Visual'));
    expect(
      screen.getByText('Fix JSON syntax before switching to Visual mode')
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId('schema-visual-editor')
    ).not.toBeInTheDocument();
  });

  it('calls onChange with stringified JSON when visual editor changes', async () => {
    const onChange = jest.fn();
    render(
      <SchemaToggleEditor
        value={validJsonSchema}
        onChange={onChange}
        schemaType={SchemaType.JSON}
      />
    );
    fireEvent.click(screen.getByText('Visual'));
    await waitFor(() => {
      expect(screen.getByTestId('schema-visual-editor')).toBeInTheDocument();
    });
    const textarea = screen.getByTestId('schema-visual-editor-input');
    fireEvent.change(textarea, { target: { value: '{"type":"string"}' } });
    expect(onChange).toHaveBeenCalledWith(
      JSON.stringify({ type: 'string' }, null, '\t')
    );
  });

  it('renders both tabs in readOnly mode', () => {
    render(
      <SchemaToggleEditor
        value={validJsonSchema}
        onChange={jest.fn()}
        schemaType={SchemaType.JSON}
        readOnly
      />
    );
    expect(screen.getByText('Visual')).toBeInTheDocument();
    expect(screen.getByText('Code')).toBeInTheDocument();
  });
});
