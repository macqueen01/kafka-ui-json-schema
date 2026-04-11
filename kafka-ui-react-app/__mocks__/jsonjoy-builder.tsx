import React from 'react';

export const SchemaVisualEditor: React.FC<{
  schema: Record<string, unknown>;
  onChange?: (s: Record<string, unknown>) => void;
}> = ({ schema, onChange }) => (
  <div data-testid="schema-visual-editor">
    <textarea
      data-testid="schema-visual-editor-input"
      defaultValue={JSON.stringify(schema, null, 2)}
      onChange={(e) => {
        try {
          onChange?.(JSON.parse(e.target.value));
        } catch {
          /* noop */
        }
      }}
    />
  </div>
);

export const JsonSchemaEditor = SchemaVisualEditor;
export const TranslationContext = React.createContext(null);
export type JSONSchema = Record<string, unknown>;
