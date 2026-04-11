import React from 'react';
import Edit from 'components/Schemas/Edit/Edit';
import { render, WithRoute } from 'lib/testHelpers';
import { clusterSchemaEditPath } from 'lib/paths';
import {
  schemasInitialState,
  schemaVersion,
} from 'redux/reducers/schemas/__test__/fixtures';
import { screen } from '@testing-library/dom';
import ClusterContext, {
  ContextProps,
  initialValue as contextInitialValue,
} from 'components/contexts/ClusterContext';
import { RootState } from 'redux/interfaces';

jest.mock('components/common/SchemaToggleEditor', () => ({
  __esModule: true,
  default: ({
    onChange,
    value,
    name,
  }: {
    onChange?: (v: string) => void;
    value: string;
    name: string;
  }) => (
    <textarea
      aria-label={name}
      name={name}
      defaultValue={value}
      onChange={(e) => onChange?.(e.target.value)}
    />
  ),
}));

jest.mock('components/common/EditorViewer/EditorViewer', () => ({
  __esModule: true,
  default: ({ data }: { data: string }) => <pre>{data}</pre>,
}));

const clusterName = 'testClusterName';

const renderComponent = (
  initialState: RootState['schemas'] = schemasInitialState,
  context: ContextProps = contextInitialValue
) =>
  render(
    <WithRoute path={clusterSchemaEditPath()}>
      <ClusterContext.Provider value={context}>
        <Edit />
      </ClusterContext.Provider>
    </WithRoute>,
    {
      initialEntries: [
        clusterSchemaEditPath(clusterName, schemaVersion.subject),
      ],
      preloadedState: {
        schemas: initialState,
      },
    }
  );

describe('Edit', () => {
  describe('fetch success', () => {
    describe('has schema versions', () => {
      it('renders component with schema info', async () => {
        renderComponent();
        expect(await screen.findByText('Submit')).toBeInTheDocument();
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      });
    });
  });

  describe('fetch success schema with non ascii characters', () => {
    describe('has schema versions', () => {
      it('renders component with schema info', async () => {
        renderComponent();
        expect(await screen.findByText('Submit')).toBeInTheDocument();
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      });
    });
  });
});
