import React from 'react';
import LatestVersionItem from 'components/Schemas/Details/LatestVersion/LatestVersionItem';
import { render } from 'lib/testHelpers';
import { screen } from '@testing-library/react';
import * as featureFlags from 'lib/featureFlags';

import { jsonSchema, protoSchema } from './fixtures';

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

describe('LatestVersionItem', () => {
  it('renders latest version of json schema', () => {
    jest.mocked(featureFlags.isVisualSchemaEditorEnabled).mockReturnValue(true);
    render(<LatestVersionItem schema={jsonSchema} />);
    expect(screen.getByText('Actual version')).toBeInTheDocument();
    expect(screen.getByText('Latest version')).toBeInTheDocument();
    expect(screen.getByText('ID')).toBeInTheDocument();
    expect(screen.getByText('Subject')).toBeInTheDocument();
    expect(screen.getByText('Compatibility')).toBeInTheDocument();
    expect(screen.getByText('15')).toBeInTheDocument();
    expect(screen.getByTestId('schema-toggle-editor')).toBeInTheDocument();
  });

  it('renders latest version of compatibility', () => {
    jest.mocked(featureFlags.isVisualSchemaEditorEnabled).mockReturnValue(true);
    render(<LatestVersionItem schema={protoSchema} />);
    expect(screen.getByText('Actual version')).toBeInTheDocument();
    expect(screen.getByText('Latest version')).toBeInTheDocument();
    expect(screen.getByText('ID')).toBeInTheDocument();
    expect(screen.getByText('Subject')).toBeInTheDocument();
    expect(screen.getByText('Compatibility')).toBeInTheDocument();
    expect(screen.getByText('BACKWARD')).toBeInTheDocument();
    expect(screen.queryByTestId('schema-toggle-editor')).not.toBeInTheDocument();
  });
});
