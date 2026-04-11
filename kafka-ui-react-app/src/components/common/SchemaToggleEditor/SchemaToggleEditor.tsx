import React from 'react';
import type { JSONSchema } from 'jsonjoy-builder';
import { SchemaType } from 'generated-sources';
import Editor from 'components/common/Editor/Editor';
import { isVisualSchemaEditorEnabled } from 'lib/featureFlags';
import styled from 'styled-components';

interface SchemaToggleEditorProps {
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
  schemaType?: SchemaType;
  height?: string;
  name?: string;
}

const TabBar = styled.div`
  display: flex;
  gap: 0;
  margin-bottom: 4px;
`;

const Tab = styled.button<{ $active: boolean }>`
  padding: 4px 12px;
  border: 1px ${({ theme }) => theme.input.borderColor.normal} solid;
  background: ${({ $active, theme }) =>
    $active ? theme.default.backgroundColor : theme.hr.backgroundColor};
  cursor: pointer;
  font-size: 12px;
  color: ${({ theme }) => theme.input.color.normal};
  &:first-child {
    border-radius: 4px 0 0 4px;
  }
  &:last-child {
    border-radius: 0 4px 4px 0;
  }
`;

const ErrorMsg = styled.div`
  color: ${({ theme }) => theme.input.error};
  font-size: 12px;
  padding: 4px 0;
`;

const SuspenseFallback = styled.div<{ $height: string }>`
  height: ${({ $height }) => $height};
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${({ theme }) => theme.topicFormLabel.color};
  font-size: 12px;
`;

const LazyVisualEditor = React.lazy(() =>
  import('jsonjoy-builder').then((m) => ({ default: m.SchemaVisualEditor }))
);

const SchemaToggleEditor: React.FC<SchemaToggleEditorProps> = ({
  value,
  onChange,
  readOnly = false,
  schemaType,
  height = '372px',
  name,
}) => {
  const [activeTab, setActiveTab] = React.useState<'visual' | 'code'>('code');
  const [switchError, setSwitchError] = React.useState<string | null>(null);

  const showToggle =
    isVisualSchemaEditorEnabled() && schemaType === SchemaType.JSON;

  if (!showToggle) {
    return (
      <Editor
        readOnly={readOnly}
        value={value}
        name={name || 'schema-editor'}
        onChange={onChange}
        height={height}
        schemaType={schemaType}
      />
    );
  }

  const handleTabSwitch = (tab: 'visual' | 'code') => {
    if (tab === 'visual') {
      try {
        JSON.parse(value || '{}');
        setSwitchError(null);
        setActiveTab('visual');
      } catch {
        setSwitchError('Fix JSON syntax before switching to Visual mode');
      }
    } else {
      setSwitchError(null);
      setActiveTab('code');
    }
  };

  const handleVisualChange = (schema: JSONSchema) => {
    onChange(JSON.stringify(schema, null, '\t'));
  };

  let parsedSchema: JSONSchema = {} as JSONSchema;
  try {
    parsedSchema = JSON.parse(value || '{}') as JSONSchema;
  } catch {
    parsedSchema = {} as JSONSchema;
  }

  return (
    <div>
      <TabBar>
        <Tab
          type="button"
          $active={activeTab === 'visual'}
          onClick={() => handleTabSwitch('visual')}
        >
          Visual
        </Tab>
        <Tab
          type="button"
          $active={activeTab === 'code'}
          onClick={() => handleTabSwitch('code')}
        >
          Code
        </Tab>
      </TabBar>
      {switchError && <ErrorMsg>{switchError}</ErrorMsg>}
      {activeTab === 'visual' ? (
        <React.Suspense
          fallback={
            <SuspenseFallback $height={height}>
              Loading visual editor...
            </SuspenseFallback>
          }
        >
          <LazyVisualEditor
            schema={parsedSchema}
            readOnly={readOnly}
            onChange={handleVisualChange}
          />
        </React.Suspense>
      ) : (
        <Editor
          readOnly={readOnly}
          value={value}
          name={name || 'schema-editor'}
          onChange={onChange}
          height={height}
          schemaType={schemaType}
        />
      )}
    </div>
  );
};

export default SchemaToggleEditor;
