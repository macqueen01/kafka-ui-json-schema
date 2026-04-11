import React from 'react';
import type { JSONSchema } from 'jsonjoy-builder';

export const SchemaVisualEditor = ({
  schema,
  onChange,
}: {
  schema: JSONSchema;
  onChange?: (s: JSONSchema) => void;
  readOnly?: boolean;
}) => (
  <div data-testid="schema-visual-editor">
    <textarea
      data-testid="schema-visual-editor-input"
      defaultValue={JSON.stringify(schema, null, 2)}
      onChange={(e) => {
        try {
          onChange?.(JSON.parse(e.target.value));
        } catch { }
      }}
    />
  </div>
);

export const JsonSchemaEditor = ({
  schema,
  setSchema,
  readOnly,
}: {
  schema: JSONSchema;
  setSchema?: (s: JSONSchema) => void;
  readOnly?: boolean;
}) => (
  <div data-testid="json-schema-editor" aria-readonly={readOnly}>
    <textarea
      data-testid="json-schema-editor-input"
      defaultValue={JSON.stringify(schema, null, 2)}
      readOnly={readOnly}
      onChange={(e) => {
        try {
          setSchema?.(JSON.parse(e.target.value));
        } catch { }
      }}
    />
  </div>
);

export const TranslationContext = React.createContext(null);

export type { JSONSchema };
