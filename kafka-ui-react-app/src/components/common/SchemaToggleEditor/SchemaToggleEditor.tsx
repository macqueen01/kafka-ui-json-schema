import React from 'react';
import type { JSONSchema } from 'jsonjoy-builder';
import { SchemaType } from 'generated-sources';
import Editor from 'components/common/Editor/Editor';
import { isVisualSchemaEditorEnabled } from 'lib/featureFlags';

interface SchemaToggleEditorProps {
  value: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
  schemaType?: SchemaType;
  height?: string;
  name?: string;
}

const LazyJsonSchemaEditor = React.lazy(() =>
  import('jsonjoy-builder').then((m) => ({ default: m.JsonSchemaEditor }))
);

const SchemaToggleEditor: React.FC<SchemaToggleEditorProps> = ({
  value,
  onChange = () => undefined,
  readOnly = false,
  schemaType,
  height = '372px',
  name,
}) => {
  const showVisual =
    isVisualSchemaEditorEnabled() && schemaType === SchemaType.JSON;

  if (!showVisual) {
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

  let parsedSchema: JSONSchema = { type: 'object' } as JSONSchema;
  if (value && value.trim()) {
    try {
      parsedSchema = JSON.parse(value) as JSONSchema;
    } catch {
      parsedSchema = { type: 'object' } as JSONSchema;
    }
  }

  const handleSchemaChange = (schema: JSONSchema) => {
    onChange(JSON.stringify(schema, null, 2));
  };

  return (
    <React.Suspense
      fallback={
        <div
          style={{
            height,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '12px',
            color: '#888',
          }}
        >
          Loading visual editor...
        </div>
      }
    >
      <LazyJsonSchemaEditor
        schema={parsedSchema}
        setSchema={handleSchemaChange}
        readOnly={readOnly}
      />
    </React.Suspense>
  );
};

export default SchemaToggleEditor;
