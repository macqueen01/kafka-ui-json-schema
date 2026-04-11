import React from 'react';
import { SchemaType } from 'generated-sources';
import SchemaToggleEditor from 'components/common/SchemaToggleEditor';
import { isVisualSchemaEditorEnabled } from 'lib/featureFlags';
import styled from 'styled-components';

interface SchemaVisualViewerProps {
  schemaString: string | undefined;
}

const CollapsibleWrapper = styled.div`
  margin-bottom: 8px;
`;

const ToggleButton = styled.button`
  background: none;
  border: none;
  cursor: pointer;
  font-size: 12px;
  color: ${({ theme }) => theme.topicFormLabel.color};
  padding: 4px 0;
  display: flex;
  align-items: center;
  gap: 4px;
`;

const SchemaVisualViewer: React.FC<SchemaVisualViewerProps> = ({
  schemaString,
}) => {
  const [isOpen, setIsOpen] = React.useState(false);

  if (!schemaString || !isVisualSchemaEditorEnabled()) return null;

  try {
    JSON.parse(schemaString);
  } catch {
    return null;
  }

  return (
    <CollapsibleWrapper>
      <ToggleButton type="button" onClick={() => setIsOpen(!isOpen)}>
        {isOpen ? '▼' : '▶'} Schema Structure
      </ToggleButton>
      {isOpen && (
        <SchemaToggleEditor
          name="serde-schema"
          value={schemaString}
          schemaType={SchemaType.JSON}
          readOnly
        />
      )}
    </CollapsibleWrapper>
  );
};

export default SchemaVisualViewer;
