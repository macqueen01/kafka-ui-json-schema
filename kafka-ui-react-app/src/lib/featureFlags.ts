export const isVisualSchemaEditorEnabled = (): boolean =>
  import.meta.env.VITE_ENABLE_VISUAL_SCHEMA_EDITOR === 'true';
