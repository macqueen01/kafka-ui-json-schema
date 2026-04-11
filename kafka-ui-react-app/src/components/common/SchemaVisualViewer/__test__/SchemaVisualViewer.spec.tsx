import React from 'react';
import { render } from 'lib/testHelpers';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SchemaVisualViewer from 'components/common/SchemaVisualViewer';
import * as featureFlags from 'lib/featureFlags';

jest.mock('lib/featureFlags', () => ({
  isVisualSchemaEditorEnabled: jest.fn(),
}));

jest.mock('components/common/SchemaToggleEditor', () => ({
  __esModule: true,
  default: ({ value, name }: { value: string; name: string }) => (
    <div data-testid="schema-toggle-editor" aria-label={name}>
      {value}
    </div>
  ),
}));

describe('SchemaVisualViewer', () => {
  beforeEach(() => {
    jest.mocked(featureFlags.isVisualSchemaEditorEnabled).mockReturnValue(true);
  });

  it('renders nothing when schemaString is undefined', () => {
    render(<SchemaVisualViewer schemaString={undefined} />);
    expect(screen.queryByText(/Schema Structure/)).not.toBeInTheDocument();
  });

  it('renders nothing when schemaString is invalid JSON', () => {
    render(<SchemaVisualViewer schemaString="not-json" />);
    expect(screen.queryByText(/Schema Structure/)).not.toBeInTheDocument();
  });

  it('renders collapsed toggle when schemaString is valid JSON', () => {
    render(<SchemaVisualViewer schemaString='{"type":"object"}' />);
    expect(screen.getByText(/Schema Structure/)).toBeInTheDocument();
    expect(
      screen.queryByTestId('schema-toggle-editor')
    ).not.toBeInTheDocument();
  });

  it('expands to show SchemaToggleEditor when toggle is clicked', async () => {
    render(<SchemaVisualViewer schemaString='{"type":"object"}' />);
    await userEvent.click(screen.getByText(/Schema Structure/));
    expect(screen.getByTestId('schema-toggle-editor')).toBeInTheDocument();
  });

  it('renders nothing when feature flag is off', () => {
    jest
      .mocked(featureFlags.isVisualSchemaEditorEnabled)
      .mockReturnValue(false);
    render(<SchemaVisualViewer schemaString='{"type":"object"}' />);
    expect(screen.queryByText(/Schema Structure/)).not.toBeInTheDocument();
  });
});
