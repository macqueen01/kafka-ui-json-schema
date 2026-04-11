# SchemaToggleEditor → JsonSchemaEditor Refactor

## What Changed
- `SchemaToggleEditor` now renders `JsonSchemaEditor` (full split-panel) for JSON type with feature flag on
- Removed tab system (`TabBar`, `Tab`, `ErrorMsg`, `SuspenseFallback` styled-components) — `JsonSchemaEditor` handles dual-panel internally
- `__mocks__/jsonjoy-builder.tsx` updated with proper `JsonSchemaEditor` mock (`setSchema` prop, `data-testid="json-schema-editor"`)

## Key Learnings

### 1. `roots: ['<rootDir>/src']` breaks root-level `__mocks__` for node modules
When `jest.config.ts` sets `roots: ['<rootDir>/src']`, calling `jest.mock('moduleName')` without a factory does NOT use `<rootDir>/__mocks__/moduleName.tsx`. Jest calls `_generateMock` instead, which tries to load the real ESM module and fails with `SyntaxError: Cannot use import statement outside a module`.

**Fix**: Always use an inline factory in the spec when `roots` differs from project root:
```ts
jest.mock('jsonjoy-builder', () => ({ __esModule: true, JsonSchemaEditor: ... }));
```

### 2. Empty catch blocks fail `no-empty` ESLint rule
`} catch { }` or `} catch (e) {}` triggers `no-empty`. Solution: restructure to avoid the catch (since mock onChange only receives valid JSON in tests), or use `} catch (_e) { return; }` if unavoidable.

### 3. `userEvent.type` breaks on `{` in JSON strings
`@testing-library/user-event` v14 treats `{` as a special key modifier. To fire a JSON-value onChange, use `fireEvent.change(input, { target: { value: '{"type":"string"}' } })` instead.

### 4. `value || '{}'` doesn't default to `{ type: 'object' }`
`'' || '{}'` parses to `{}`, not `{ type: 'object' }`. Guard with `if (value && value.trim())` so the initial default `{ type: 'object' }` is preserved for empty/blank values.

### 5. `JsonSchemaEditor` prop is `setSchema`, not `onChange`
The prop name differs from `SchemaVisualEditor`. Using wrong prop silently drops all changes.
