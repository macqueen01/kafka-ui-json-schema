import React from 'react';
import New from 'components/Schemas/New/New';
import { render, WithRoute } from 'lib/testHelpers';
import { clusterSchemaNewPath } from 'lib/paths';
import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

jest.mock('components/common/SchemaToggleEditor', () => ({
  __esModule: true,
  default: ({
    name,
    onChange,
    value,
  }: {
    name: string;
    onChange: (v: string) => void;
    value: string;
  }) => (
    <textarea
      name={name}
      aria-label="Schema"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

const clusterName = 'local';
const subjectValue = 'subject';
const schemaValue = 'schema';

describe('New Component', () => {
  const renderComponent = async () => {
    render(
      <WithRoute path={clusterSchemaNewPath()}>
        <New />
      </WithRoute>,
      {
        initialEntries: [clusterSchemaNewPath(clusterName)],
      }
    );
  };

  beforeEach(async () => {
    await act(renderComponent);
  });

  it('renders component', async () => {
    expect(screen.getByText('Create')).toBeInTheDocument();
  });

  it('submit button will be disabled while form fields are not filled', () => {
    const submitBtn = screen.getByRole('button', { name: /submit/i });
    expect(submitBtn).toBeDisabled();
  });

  it('submit button will be enabled when form fields are filled', async () => {
    const subject = screen.getByPlaceholderText('Schema Name');
    const schema = screen.getByRole('textbox', { name: /schema/i });
    const schemaTypeSelect = screen.getByRole('listbox');

    await userEvent.type(subject, subjectValue);
    await userEvent.type(schema, schemaValue);
    await userEvent.selectOptions(schemaTypeSelect, ['AVRO']);

    const submitBtn = screen.getByRole('button', { name: /Submit/i });
    expect(submitBtn).toBeEnabled();
  });
});
