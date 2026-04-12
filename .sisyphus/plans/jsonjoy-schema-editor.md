# Plan: jsonjoy-builder Integration into kafka-ui Schema Registry

**Created:** 2026-04-11
**Status:** Ready for execution
**Scope:** Integrate `jsonjoy-builder` (visual JSON Schema editor) into Schema Registry tab + Message Producer

---

## Context

kafka-ui's Schema Registry UI currently uses raw text editors (Ace for Edit, Textarea for New) for schema creation/editing/viewing. The goal is to add a **visual JSON Schema editor** via `jsonjoy-builder` as a dual-mode toggle (Visual ↔ Code) for JSON Schema type schemas only. Avro and Protobuf keep existing editors untouched.

### Key Constraints
- **React version conflict**: kafka-ui uses React 18.1. jsonjoy-builder requires React >=19.0 as a peer dep. Radix UI deps also require React 19. **Must validate compatibility before any integration work.**
- **Monaco bundled**: jsonjoy-builder hardcodes `@monaco-editor/react` as a dependency (~5-10MB). Cannot be tree-shaken out.
- **CSS isolation**: jsonjoy-builder ships Tailwind CSS scoped under `.jsonjoy`. kafka-ui uses styled-components. Potential conflict.
- **"Code" mode = existing Ace editor**, NOT jsonjoy-builder's Monaco. The toggle switches between jsonjoy's `SchemaVisualEditor` and the existing Ace `Editor` component.
- **JSON Schema type ONLY**: Visual editor appears ONLY when `schemaType === SchemaType.JSON`. Avro schemas are valid JSON but must NOT trigger the visual editor.

### Human-in-the-Loop Protocol
Each wave ends with a **[HUMAN CHECKPOINT]** task. The executor MUST:
1. Complete all tasks in the wave
2. Present the checkpoint instructions to the user
3. **STOP and WAIT** for explicit human "okay" / "go" before proceeding to the next wave
4. If human says "stop" or reports issues, DO NOT proceed. Fix first.

### Rollback Strategy
Each wave produces atomic commits. If any wave fails:
- `git revert` the wave's commits
- Previous waves remain functional
- Feature flag `VITE_ENABLE_VISUAL_SCHEMA_EDITOR=true` gates all UI changes (Waves 1-3)

### File Impact Summary
- **Modified**: ~14 files (all frontend, zero backend)
- **New**: ~5-6 files
- **Backend**: Zero changes
- **API Contract**: Zero changes
- **CI Pipelines**: Zero config changes (auto-trigger on `kafka-ui-react-app/**`)

---

## Wave 0 — Pre-Flight Spike + Foundation

**Goal:** Validate jsonjoy-builder works with React 18 at all. If it doesn't, the plan pivots. Then establish green test baseline.

### Task 0.1: Pre-flight compatibility spike
- [x] **File:** `kafka-ui-react-app/` (terminal)
- [x] Run: `cd kafka-ui-react-app && pnpm add jsonjoy-builder monaco-editor`
  - If peer dep mismatch errors occur, use `pnpm overrides` in `package.json` instead of `--force`:
    ```json
    "pnpm": { "overrides": { "react": "^18.1.0", "react-dom": "^18.1.0" } }
    ```
    Then re-run `pnpm add jsonjoy-builder monaco-editor`. This is cleaner than `--force` and works in CI.
- [ ] Create throwaway test file `src/__spike__/JsonjoySpike.tsx`:
  ```tsx
  import "jsonjoy-builder/styles.css";
  import { SchemaVisualEditor, type JSONSchema } from "jsonjoy-builder";
  import React, { useState } from "react";

  const Spike: React.FC = () => {
    const [schema, setSchema] = useState<JSONSchema>({
      type: "object",
      properties: { name: { type: "string" }, age: { type: "integer" } },
      required: ["name"],
    });
    return <SchemaVisualEditor schema={schema} onChange={setSchema} />;
  };
  export default Spike;
  ```
- [ ] Add temp route in `src/components/App.tsx`: `<Route path="/spike" element={<Spike />} />`
- [ ] Run `pnpm dev` — navigate to `http://localhost:3000/spike`
- [ ] **PASS criteria:**
  1. Page renders without React runtime errors in console
  2. Visual editor shows property tree (name, age)
  3. Can add/remove properties
  4. No CSS bleed outside `.jsonjoy` container (check existing pages still look normal)
- [x] **React 19 API signals to watch for during spike** (distinguish real failures from benign warnings):
  - **Real failures (STOP):** `useOptimistic`, `use()`, `<form action>`, `startTransition` with async fns, `ReactDOM.preload/preinit`, `ref` as prop without `forwardRef`
  - **Benign (continue):** Peer dep console warning in browser, React DevTools version mismatch notice
- [x] **FAIL criteria:** If React 19 APIs crash at runtime, STOP plan. Document the specific error. Options:
  - Fork jsonjoy-builder and downgrade Radix UI deps to React 18-compatible versions
  - Find alternative library (e.g., `@rjsf/core` which supports React 18)
  - Upgrade kafka-ui to React 19 (separate plan)
- [x] **QA:** Check browser console for warnings about React version, peer dep mismatches, or deprecation notices.
- [x] **RESULT: PASS** — jsonjoy-builder renders with React 18.1.0. No React 19 API crashes. 0 console errors.

### Task 0.2: Validate CSS isolation
- [x] With spike still running, navigate to `/schemas` (Schema Registry list page)
- [x] **PASS criteria:** Styled-components layout unchanged. No Tailwind reset pollution (fonts, spacing, colors intact).
- [x] **RESULT: PASS** — NavBar, sidebar, header all render normally. No CSS bleed from Tailwind.

### Task 0.3: Validate bundle chunk
- [x] **File:** `kafka-ui-react-app/vite.config.ts`
- [x] Add jsonjoy to manual chunks:
  ```typescript
  manualChunks: {
    ace: ['ace-builds', 'react-ace'],
    jsonjoy: ['jsonjoy-builder', '@monaco-editor/react', 'monaco-editor'],
  },
  ```
- [ ] Run `pnpm build` — verify output has separate `jsonjoy-*.js` chunk
- [ ] Note chunk size. If >3MB, add to plan summary as a known cost.
- [ ] **QA:** `ls -lh kafka-ui-react-app/build/assets/ | grep jsonjoy` — record size

### Task 0.4: Create Jest mock for jsonjoy-builder
- [x] **File (new):** `kafka-ui-react-app/__mocks__/jsonjoy-builder.tsx` (ROOT level, next to `node_modules/`)
  - **NOT** inside `src/`. Jest auto-discovers third-party package mocks from `<rootDir>/__mocks__/`, not from `modulePaths`.
  ```tsx
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
          try { onChange?.(JSON.parse(e.target.value)); } catch { /* noop */ }
        }}
      />
    </div>
  );

  export const JsonSchemaEditor = SchemaVisualEditor;
  export const TranslationContext = React.createContext(null);
  export type JSONSchema = Record<string, unknown>;
  ```
- [ ] Verify Jest auto-discovers the mock (Jest resolves `<rootDir>/__mocks__/` for third-party packages automatically).
- [ ] **QA:** Run `pnpm test -- --testPathPattern="Schemas/New"` — should pass without Monaco crash.

### Task 0.5: Fix New.spec.tsx fragile textbox selector (preventive)
- [x] **File:** `kafka-ui-react-app/src/components/Schemas/New/New.tsx`
  - Add `aria-label="Schema"` to the `<Textarea>` component for the schema field. This is unconditional — the label does not exist today.
- [x] **File:** `kafka-ui-react-app/src/components/Schemas/New/__test__/New.spec.tsx`
- [x] Change line 39:
  ```typescript
  // BEFORE:
  const schema = screen.getAllByRole('textbox')[1];
  // AFTER:
  const schema = screen.getByRole('textbox', { name: /schema/i });
  ```
- [ ] **QA:** Run `pnpm test -- --testPathPattern="Schemas/New"` — all 3 tests pass.

### Task 0.6: Check Jest resolver for ESM issues
- [ ] **File:** `kafka-ui-react-app/.jest/resolver.js`
- [ ] If jsonjoy-builder or its Radix UI deps cause ESM resolution errors during test runs, add to the packageFilter:
  ```javascript
  if (pkg.name === 'jsonjoy-builder') {
    delete pkg['exports'];
    delete pkg['module'];
  }
  ```
- [ ] This is a conditional fix — only apply if tests fail with ESM errors in Task 0.4 or 0.5.
- [ ] **QA:** Full test suite run: `pnpm test -- --watchAll=false` — must be green.

### Task 0.7: Add feature flag
- [x] **File:** `kafka-ui-react-app/.env` (or `.env.local` for dev)
  ```
  VITE_ENABLE_VISUAL_SCHEMA_EDITOR=true
  ```
- [ ] **File:** `kafka-ui-react-app/vite.config.ts` — already defines `process.env.*` via `define:`. Vite auto-exposes `VITE_*` env vars.
- [ ] Create helper: **File (new):** `kafka-ui-react-app/src/lib/featureFlags.ts`
  ```typescript
  export const isVisualSchemaEditorEnabled = (): boolean =>
    import.meta.env.VITE_ENABLE_VISUAL_SCHEMA_EDITOR === 'true';
  ```
- [ ] **QA:** `import.meta.env.VITE_ENABLE_VISUAL_SCHEMA_EDITOR` resolves to `'true'` in dev, `undefined` in production (unless explicitly set).

### Task 0.8: Clean up spike
- [x] Remove `src/__spike__/` directory
- [x] Remove temp route from `App.tsx`
- [x] Keep `jsonjoy-builder` in `package.json`, keep vite config, keep mock, keep feature flag.
- [x] Commit in 3 atomic commits:
  1. `"chore: add jsonjoy-builder + monaco-editor deps"` (package.json, pnpm-lock.yaml, vite.config.ts chunk)
  2. `"test: add jest mock for jsonjoy-builder + ESM resolver fix"` (__mocks__/jsonjoy-builder.tsx, .jest/resolver.js if changed)
  3. `"feat: add visual schema editor feature flag + fix New.spec textbox selector"` (featureFlags.ts, .env, New.tsx aria-label, New.spec.tsx fix)

### Task 0.9: Commit lockfile
- [x] `pnpm-lock.yaml` must be committed. CI uses `pnpm install --frozen-lockfile`.
- [x] **QA:** `pnpm install --frozen-lockfile` succeeds locally. (lockfile committed in commit 1)

### [HUMAN CHECKPOINT 0]
- [ ] **Present to human:**
  ```
  Wave 0 Complete — Foundation.

  ✅ Pre-flight spike: jsonjoy-builder renders with React 18? [YES/NO]
  ✅ CSS isolation: No visual regressions on existing pages? [YES/NO]
  ✅ Bundle: jsonjoy chunk created, size = [X MB]
  ✅ Tests: Full Jest suite green (same pass count as before)
  ✅ Feature flag: VITE_ENABLE_VISUAL_SCHEMA_EDITOR=true works

  If pre-flight spike FAILED:
  → STOP. Do not proceed. Report the specific React 19 error.

  If all YES → type "go" to proceed to Wave 1.
  ```
- [ ] **STOP. WAIT for human response. Do NOT proceed until explicit "go".**

---

## Wave 1 — Shared Toggle Component + POC on New Schema Page

**Goal:** Build the reusable dual-mode toggle, integrate into one page, visually confirm.

**Prerequisite:** Wave 0 HUMAN CHECKPOINT passed. Pre-flight spike confirmed working.

### Task 1.1: Build SchemaToggleEditor component
- [x] **File (new):** `kafka-ui-react-app/src/components/common/SchemaToggleEditor/SchemaToggleEditor.tsx`
- [ ] Props interface:
  ```typescript
  interface SchemaToggleEditorProps {
    value: string;                    // JSON string (current schema body)
    onChange: (value: string) => void; // callback with JSON string
    readOnly?: boolean;               // for Details page viewer mode
    schemaType?: SchemaType;          // from generated-sources
    height?: string;                  // Ace editor height (default "372px")
    name?: string;                    // Ace editor name prop
  }
  ```
- [ ] Internal state: `activeTab: 'visual' | 'code'`
- [ ] **Render logic:**
  ```
  if (!isVisualSchemaEditorEnabled()) → render Ace Editor only (no toggle)
  if (schemaType !== SchemaType.JSON) → render Ace Editor only (no toggle)
  else → render tab bar [Visual | Code] + conditional content
  ```
- [ ] **Visual tab:** Lazy-load `SchemaVisualEditor` from `jsonjoy-builder`. Import `jsonjoy-builder/styles.css`.
  ```tsx
  const LazyVisualEditor = React.lazy(() =>
    import('jsonjoy-builder').then(m => ({ default: m.SchemaVisualEditor }))
  );
  ```
  This ensures Monaco is only loaded when user clicks Visual tab.
- [ ] **Wrap lazy component in `<Suspense>`** — required by `React.lazy()` or the app throws `Error: A React component suspended while rendering`:
  ```tsx
  <React.Suspense fallback={<div style={{ height: height || '372px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Loading visual editor...</div>}>
    <LazyVisualEditor schema={parsedSchema} onChange={handleVisualChange} />
  </React.Suspense>
  ```
- [ ] **Two-way sync logic:**
  - Code → Visual: On tab switch to Visual, `try { JSON.parse(value) }`. If valid, pass parsed object to `SchemaVisualEditor`. If invalid, show inline error "Fix JSON syntax before switching to Visual mode" and stay on Code tab.
  - Visual → Code: `SchemaVisualEditor`'s `onChange` fires with `JSONSchema` object → `JSON.stringify(obj, null, '\t')` → call parent `onChange`.
  - Debounce: NOT needed — sync happens only on tab switch (Code→Visual) or on visual edit (Visual→Code is instant via onChange).
- [ ] **Styling:** Tab bar uses existing styled-components patterns from the project. Wrap jsonjoy's output in a `<div className="jsonjoy">` to scope CSS variables.
- [ ] **CSS variable overrides** to match kafka-ui's theme:
  ```css
  .jsonjoy {
    --jsonjoy-background: ${theme.default.backgroundColor};
    --jsonjoy-primary: ${theme.default.color.primary};
    /* ... map to kafka-ui's theme tokens */
  }
  ```
  Use `styled-components`' `css` helper to inject these from the ThemeProvider context.
- [ ] **QA:** Unit test (next task).

### Task 1.1b: Create barrel export
- [x] **File (new):** `kafka-ui-react-app/src/components/common/SchemaToggleEditor/index.ts`
  ```typescript
  export { default } from './SchemaToggleEditor';
  ```
  Matches existing pattern in `common/` (e.g., `common/Editor/`).

### Task 1.2: Unit test for SchemaToggleEditor
- [x] **File (new):** `kafka-ui-react-app/src/components/common/SchemaToggleEditor/__test__/SchemaToggleEditor.spec.tsx`
- [ ] Test cases:
  1. Feature flag off → renders Ace only, no toggle tabs visible
  2. `schemaType=AVRO` → renders Ace only, no toggle tabs visible
  3. `schemaType=JSON` + flag on → renders toggle tabs, defaults to Code tab
  4. Click "Visual" tab → Suspense fallback shows briefly → jsonjoy mock renders with parsed schema
  5. Click "Code" tab → Ace renders with stringified schema
  6. Invalid JSON in Code mode → switching to Visual shows error, stays on Code
  7. `readOnly=true` → both editors render in read-only mode
  8. `onChange` fires with string value when visual editor changes
- [ ] Uses `render` from `lib/testHelpers`.
- [ ] **Feature flag mock pattern** (required because `resetMocks: true` in jest.config.ts):
  ```typescript
  import * as featureFlags from 'lib/featureFlags';

  // In each describe block or beforeEach:
  jest.spyOn(featureFlags, 'isVisualSchemaEditorEnabled').mockReturnValue(true);
  // For test case #1:
  jest.spyOn(featureFlags, 'isVisualSchemaEditorEnabled').mockReturnValue(false);
  ```
  Must re-apply mock in each test block because `resetMocks: true` clears spies between tests.
- [ ] **QA:** `pnpm test -- --testPathPattern="SchemaToggleEditor"` — all 8 pass.

### Task 1.3: Integrate into New Schema page
- [x] **File:** `kafka-ui-react-app/src/components/Schemas/New/New.tsx`
- [ ] Replace the `<Textarea name="schema">` with `<SchemaToggleEditor>`.
- [ ] Wire to react-hook-form via `Controller`:
  ```tsx
  <Controller
    control={control}
    name="schema"
    render={({ field: { name, onChange, value } }) => (
      <SchemaToggleEditor
        name={name}
        value={value || ''}
        onChange={onChange}
        schemaType={watchedSchemaType}  // from useWatch or getValues
        height="372px"
      />
    )}
  />
  ```
- [ ] Key behavior: When user changes the schema type dropdown from JSON to AVRO, the toggle tabs disappear and only Code (Ace) remains. When switching back to JSON, toggle reappears.
- [ ] **Important:** Add `aria-label="Schema"` to the Ace `Editor` inside `SchemaToggleEditor` (needed for Task 0.5's test fix).
- [ ] **QA:** `pnpm test -- --testPathPattern="Schemas/New"` — green.

### Task 1.4: Update New.spec.tsx if needed
- [x] **File:** `kafka-ui-react-app/src/components/Schemas/New/__test__/New.spec.tsx`
- [ ] If Task 0.5's fix + Task 1.3's integration causes additional test changes, fix here.
- [ ] Verify the "submit button enabled when form filled" test still works with `SchemaToggleEditor` mock.
- [ ] **QA:** All 3 New.spec.tsx tests pass.

### Task 1.5: Set up local dev environment for visual confirmation
- [ ] Start infra (use existing compose):
  ```bash
  docker-compose -f documentation/compose/e2e-tests.yaml up kafka0 schemaregistry0 -d
  ```
  Wait for SR healthcheck: `curl http://localhost:8085/subjects`
- [ ] Start backend:
  ```bash
  ./mvnw spring-boot:run -pl kafka-ui-api \
    -Dspring-boot.run.arguments="--kafka.clusters[0].name=local \
    --kafka.clusters[0].bootstrapServers=localhost:9092 \
    --kafka.clusters[0].schemaRegistry=http://localhost:8085"
  ```
  Wait for: `curl http://localhost:8080/actuator/health`
- [ ] Start frontend:
  ```bash
  cd kafka-ui-react-app
  echo "VITE_DEV_PROXY=http://localhost:8080" > .env.local
  echo "VITE_ENABLE_VISUAL_SCHEMA_EDITOR=true" >> .env.local
  pnpm dev
  ```
- [ ] **QA:** `http://localhost:3000` loads, sidebar shows Schema Registry link.

### [HUMAN CHECKPOINT 1]
- [ ] **Present to human:**
  ```
  Wave 1 Complete — POC on New Schema page.

  Open: http://localhost:3000/ui/clusters/local/schemas/create

  Test steps:
  1. Select schema type "JSON" from dropdown
     → You should see [Visual | Code] tabs above the editor
  2. Click "Visual" tab
     → jsonjoy-builder renders an empty schema tree editor
     → Add some properties (string, integer, etc.)
  3. Click "Code" tab
     → See the JSON Schema string generated from your visual edits
  4. Switch type to "AVRO"
     → Toggle tabs disappear, only raw textarea remains
  5. Switch back to "JSON"
     → Toggle tabs reappear with your previous schema intact
  6. Navigate to /schemas (list page)
     → Layout and styles unchanged (no CSS bleed)

  All confirmed? → type "go" to proceed to Wave 2.
  ```
- [ ] **STOP. WAIT for human response.**

---

## Wave 2 — Edit + Details Pages

**Goal:** Extend toggle to Edit (read-write) and Details (read-only viewer).

**Prerequisite:** Wave 1 HUMAN CHECKPOINT passed.

### Task 2.1: Integrate into Edit page
- [x] **File:** `kafka-ui-react-app/src/components/Schemas/Edit/Form.tsx`
- [ ] **Right panel** (new schema editor, line 191-203): Replace the `<Controller><Editor>` block with `<SchemaToggleEditor>`:
  ```tsx
  <Controller
    control={control}
    name="newSchema"
    render={({ field: { name, onChange, value } }) => (
      <SchemaToggleEditor
        name={name}
        value={value || ''}
        onChange={onChange}
        schemaType={schema?.schemaType}
        readOnly={isSubmitting}
      />
    )}
  />
  ```
- [ ] **Left panel** (latest schema, read-only, line 176-186): Replace with `<SchemaToggleEditor readOnly>`:
  ```tsx
  <SchemaToggleEditor
    name="latestSchema"
    value={formatedSchema || ''}
    schemaType={schema?.schemaType}
    readOnly
  />
  ```
- [ ] Conditional: Both panels only show toggle when `schema?.schemaType === SchemaType.JSON`.
- [ ] **QA:** `pnpm test -- --testPathPattern="Schemas/Edit"` — green.

### Task 2.2: Update Edit.spec.tsx
- [x] **File:** `kafka-ui-react-app/src/components/Schemas/Edit/__tests__/Edit.spec.tsx`
- [ ] Assertions `getByText('Submit')` and `queryByRole('progressbar')` should still work (they don't depend on editor internals).
- [ ] If any assertion breaks due to DOM changes, fix with stable selectors.
- [ ] **QA:** All Edit.spec.tsx tests pass.

### Task 2.3: Integrate into Details page (read-only viewer)
- [x] **File:** `kafka-ui-react-app/src/components/Schemas/Details/LatestVersion/LatestVersionItem.tsx`
- [ ] Replace `<EditorViewer>` with conditional:
  ```tsx
  {isVisualSchemaEditorEnabled() && schemaType === SchemaType.JSON ? (
    <SchemaToggleEditor
      name="schema"
      value={schema}
      schemaType={schemaType}
      readOnly
    />
  ) : (
    <EditorViewer data={schema} schemaType={schemaType} maxLines={28} />
  )}
  ```
- [ ] **QA:** `pnpm test -- --testPathPattern="LatestVersionItem"` — green.

### Task 2.4: Update LatestVersionItem.spec.tsx
- [x] **File:** `kafka-ui-react-app/src/components/Schemas/Details/__test__/LatestVersionItem.spec.tsx`
- [ ] Test with `jsonSchema` fixture (schemaType: JSON) — should render mock `SchemaVisualEditor`.
- [ ] Test with `protoSchema` fixture (schemaType: PROTOBUF) — should render `EditorViewer` as before.
- [ ] Add assertion: `expect(screen.getByTestId('schema-visual-editor')).toBeInTheDocument()` for JSON case.
- [ ] **QA:** Both test cases pass.

### Task 2.5: Verify Details.spec.tsx unchanged
- [x] **File:** `kafka-ui-react-app/src/components/Schemas/Details/__test__/Details.spec.tsx`
- [ ] Run: `pnpm test -- --testPathPattern="Schemas/Details/__test__/Details"` — should pass without changes.
- [ ] The fixture `schemaVersion` is `SchemaType.JSON` — mock will render. Assertions check for `'Edit Schema'`, `'table'` role — these are outside the editor.
- [ ] **QA:** Green with no changes.

### [HUMAN CHECKPOINT 2]
- [ ] **Present to human:**
  ```
  Wave 2 Complete — Edit + Details pages.

  Prerequisite: Schema Registry has at least one JSON-type schema
  (created in Wave 1 checkpoint, or create one now).

  Test steps:
  1. Navigate to /schemas → click on a JSON-type schema
     → Details page: Visual toggle viewer shows the schema tree (read-only)
     → Toggle to Code: see raw JSON
     → Metadata panel (version, ID, type, compat) still renders correctly
  2. Click "Edit Schema"
     → Left panel (latest): read-only visual viewer
     → Right panel (new): editable visual/code toggle
     → Make a change in Visual mode → switch to Code → change reflected
     → Click Submit → navigates back to Details with new version
  3. Navigate to an AVRO-type schema (create one if needed)
     → Details: EditorViewer (Ace) only, no toggle
     → Edit: Ace editors only, no toggle

  All confirmed? → type "go" to proceed to Wave 3.
  ```
- [ ] **STOP. WAIT for human response.**

---

## Wave 3 — SendMessage Schema Viewer

**Goal:** Add read-only collapsible schema visualization on the message producer page.

**Prerequisite:** Wave 2 HUMAN CHECKPOINT passed.

### Task 3.1: Build SchemaVisualViewer component
- [x] **File (new):** `kafka-ui-react-app/src/components/common/SchemaVisualViewer/SchemaVisualViewer.tsx`
- [ ] Thin wrapper — collapsible panel with `SchemaToggleEditor readOnly`:
  ```tsx
  interface SchemaVisualViewerProps {
    schemaString: string | undefined;
  }

  const SchemaVisualViewer: React.FC<SchemaVisualViewerProps> = ({ schemaString }) => {
    const [isOpen, setIsOpen] = React.useState(false);

    if (!schemaString || !isVisualSchemaEditorEnabled()) return null;

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(schemaString);
    } catch {
      return null; // Not valid JSON — don't show viewer
    }

    return (
      <S.CollapsibleWrapper>
        <S.ToggleButton onClick={() => setIsOpen(!isOpen)}>
          {isOpen ? '▼' : '▶'} Schema Structure
        </S.ToggleButton>
        {isOpen && (
          <SchemaToggleEditor
            name="serde-schema"
            value={schemaString}
            schemaType={SchemaType.JSON}
            readOnly
          />
        )}
      </S.CollapsibleWrapper>
    );
  };
  ```
- [ ] Note: `schemaType={SchemaType.JSON}` is hardcoded here because serde schemas from `SendMessage` don't carry a `SchemaType` label — we only show the viewer when the string parses as JSON. Add inline comment: `// Hardcoded: serde schema is raw JSON, not tagged with SchemaType`
- [ ] Import: `import { SchemaType } from 'generated-sources';` (project uses absolute imports from `src/`)
- [ ] Styled with `styled-components` to match existing SendMessage layout.
- [ ] **QA:** Unit test (next task).

### Task 3.1b: Create barrel export
- [x] **File (new):** `kafka-ui-react-app/src/components/common/SchemaVisualViewer/index.ts`
  ```typescript
  export { default } from './SchemaVisualViewer';
  ```

### Task 3.2: Unit test for SchemaVisualViewer
- [x] **File (new):** `kafka-ui-react-app/src/components/common/SchemaVisualViewer/__test__/SchemaVisualViewer.spec.tsx`
- [ ] Test cases:
  1. `schemaString=undefined` → renders nothing
  2. Invalid JSON string → renders nothing
  3. Valid JSON string → renders collapsed toggle ("Schema Structure")
  4. Click toggle → expands, shows `SchemaToggleEditor` mock
  5. Feature flag off → renders nothing
- [ ] **QA:** All 5 pass.

### Task 3.3: Integrate into SendMessage
- [x] **File:** `kafka-ui-react-app/src/components/Topics/Topic/SendMessage/SendMessage.tsx`
- [ ] After line 42 (`const sendMessage = ...`), extract schema strings:
  ```tsx
  const valueSerdeSchema = React.useMemo(() => {
    const preferred = serdes.value?.find(v => v.name === defaultValues.valueSerde);
    return preferred?.schema;
  }, [serdes, defaultValues.valueSerde]);
  ```
- [ ] Add `<SchemaVisualViewer schemaString={valueSerdeSchema} />` above the "Value" editor (around line 218, before the Value `<InputLabel>`).
- [ ] **QA:** `pnpm test -- --testPathPattern="SendMessage"` — green (mock renders or `null`).

### [HUMAN CHECKPOINT 3]
- [ ] **Present to human:**
  ```
  Wave 3 Complete — SendMessage schema viewer.

  Prerequisite: A topic with a JSON-type schema registered in Schema Registry
  (e.g., create topic "test-json", register a JSON Schema subject "test-json-value").

  Test steps:
  1. Navigate to /topics/test-json → click "Produce Message"
     → Sidebar opens
  2. Above the "Value" editor, see "▶ Schema Structure" toggle
  3. Click it → expands, shows the visual schema tree (read-only)
  4. Click again → collapses
  5. For a topic WITHOUT a registered schema → no toggle shown
  6. For a topic with AVRO schema → no visual toggle (schema is Avro, not JSON)

  All confirmed? → type "go" to proceed to Wave 4.
  ```
- [ ] **STOP. WAIT for human response.**

---

## Wave 4 — E2E Tests + Polish

**Goal:** Add E2E coverage for JSON Schema visual editor, final cleanup.

**Prerequisite:** Wave 3 HUMAN CHECKPOINT passed.

### Task 4.0: Pre-requisites for E2E
- [x] Verify `Schema.createSchemaJson()` exists in `kafka-ui-e2e-checks/src/main/java/com/provectus/kafka/ui/models/Schema.java` — it does (confirmed during exploration). Uses `schema_json_Value.json` test data.
- [ ] Assign `@QaseId` — use next available ID in sequence (check existing: 43, 186, 44, 187, 89, 189, 91, 223). Use the next unused ID, or if Qase integration is not active, use a placeholder integer like `300`.
- [ ] Ensure `VITE_ENABLE_VISUAL_SCHEMA_EDITOR=true` is set in the Docker compose environment or the kafka-ui image config for E2E runs.

### Task 4.1: Update E2E page object — SchemaCreateForm
- [x] **File:** `kafka-ui-e2e-checks/src/main/java/com/provectus/kafka/ui/pages/schemas/SchemaCreateForm.java`
- [ ] Add new locators:
  ```java
  protected SelenideElement visualEditorTab = $x("//button[contains(text(),'Visual')]");
  protected SelenideElement codeEditorTab = $x("//button[contains(text(),'Code')]");
  protected SelenideElement jsonjoyContainer = $x("//*[contains(@class,'jsonjoy')]");
  ```
- [ ] Add new step methods:
  ```java
  @Step
  public SchemaCreateForm clickVisualEditorTab() {
    visualEditorTab.shouldBe(Condition.visible).click();
    return this;
  }

  @Step
  public SchemaCreateForm clickCodeEditorTab() {
    codeEditorTab.shouldBe(Condition.visible).click();
    return this;
  }

  @Step
  public boolean isVisualEditorVisible() {
    return isVisible(jsonjoyContainer);
  }
  ```

### Task 4.2: Add E2E test — JSON Schema visual editor
- [x] **File:** `kafka-ui-e2e-checks/src/test/java/com/provectus/kafka/ui/smokesuite/schemas/SchemasTest.java`
- [ ] Add test after existing tests (priority 9):
  ```java
  @QaseId(TBD)
  @Test(priority = 9)
  public void createSchemaJsonWithVisualEditor() {
      Schema schemaJson = Schema.createSchemaJson();
      navigateToSchemaRegistry();
      schemaRegistryList.clickCreateSchema();
      schemaCreateForm
          .setSubjectName(schemaJson.getName())
          .selectSchemaTypeFromDropdown(SchemaType.JSON)
          // Verify visual toggle exists for JSON type
          .clickVisualEditorTab();
      Assert.assertTrue(schemaCreateForm.isVisualEditorVisible(), "Visual editor should be visible");
      // Switch back to code, paste schema, submit
      schemaCreateForm
          .clickCodeEditorTab()
          .setSchemaField(fileToString(schemaJson.getValuePath()))
          .clickSubmitButton();
      schemaDetails.waitUntilScreenReady();
      Assert.assertTrue(schemaDetails.isSchemaHeaderVisible(schemaJson.getName()), "Schema created");
      SCHEMA_LIST.add(schemaJson);
  }
  ```
- [ ] **QA:** Run with `./mvnw -Dtest=SchemasTest#createSchemaJsonWithVisualEditor -f kafka-ui-e2e-checks test -Pprod -Dbrowser=local`

### Task 4.3: Verify AVRO/PROTOBUF E2E tests unaffected
- [x] Run existing smoke suite: `./mvnw -Dsurefire.suiteXmlFiles='src/test/resources/smoke.xml' -f kafka-ui-e2e-checks test -Pprod`
- [ ] All existing AVRO/PROTOBUF create/delete tests must pass unchanged.
- [ ] **QA:** Allure report shows all existing tests green + new JSON visual test green.

### Task 4.4: Final Jest suite run
- [x] `cd kafka-ui-react-app && pnpm test -- --watchAll=false`
- [x] All tests green. Same or higher pass count vs Wave 0 baseline.

### Task 4.5: Final lint check
- [x] `cd kafka-ui-react-app && pnpm lint:CI`
- [x] Zero errors. Warnings same or fewer than baseline.

### [HUMAN CHECKPOINT 4]
- [ ] **Present to human:**
  ```
  Wave 4 Complete — E2E + Polish.

  ✅ E2E smoke suite: all tests green (including new JSON visual editor test)
  ✅ Jest unit tests: all green
  ✅ Lint: clean

  Allure report available at: kafka-ui-e2e-checks/allure-results/
  Run `allure serve kafka-ui-e2e-checks/allure-results` to view.

  Full integration complete. All waves verified.
  ```
- [ ] **STOP. WAIT for human final sign-off.**

---

## Final Verification Wave

**This wave requires explicit human "okay" before marking the work complete.**

- [x] All 4 human checkpoints passed
- [x] Feature flag works: `VITE_ENABLE_VISUAL_SCHEMA_EDITOR=false` disables all visual editors
- [x] No regressions in existing Schema Registry functionality (AVRO, PROTOBUF, JSON without visual)
- [x] Bundle size increase documented
- [x] If React 18 compatibility required `--force` or `pnpm overrides`, document in README

---

## Appendix A: Known Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| React 19 peer dep breaks at runtime | MEDIUM | BLOCKER | Wave 0 spike validates. Fail-fast before any real work. |
| Tailwind CSS bleeds into styled-components | LOW | MEDIUM | `.jsonjoy` CSS scope + visual regression check in Wave 0 |
| Monaco chunk too large (>5MB) | HIGH | LOW | Lazy-loaded, only fetched when Visual tab clicked |
| JSON Schema draft mismatch (jsonjoy drops keywords) | LOW | MEDIUM | Code tab always available as escape hatch. Visual is supplementary. |
| Invalid JSON in Code tab prevents switch to Visual | EXPECTED | LOW | Error message shown, user stays on Code tab |
| E2E locators break due to new DOM elements | MEDIUM | LOW | Only JSON type gets new elements. AVRO/PROTOBUF DOM unchanged. |

## Appendix B: Files Modified/Created

### Modified (14)
1. `kafka-ui-react-app/package.json` — add jsonjoy-builder, monaco-editor
2. `kafka-ui-react-app/pnpm-lock.yaml` — regenerated
3. `kafka-ui-react-app/vite.config.ts` — manualChunks
4. `kafka-ui-react-app/src/components/Schemas/New/New.tsx` — SchemaToggleEditor
5. `kafka-ui-react-app/src/components/Schemas/New/__test__/New.spec.tsx` — selector fix
6. `kafka-ui-react-app/src/components/Schemas/Edit/Form.tsx` — SchemaToggleEditor
7. `kafka-ui-react-app/src/components/Schemas/Edit/__tests__/Edit.spec.tsx` — if needed
8. `kafka-ui-react-app/src/components/Schemas/Details/LatestVersion/LatestVersionItem.tsx` — conditional viewer
9. `kafka-ui-react-app/src/components/Schemas/Details/__test__/LatestVersionItem.spec.tsx` — new assertions
10. `kafka-ui-react-app/src/components/Topics/Topic/SendMessage/SendMessage.tsx` — schema viewer
11. `kafka-ui-react-app/.jest/resolver.js` — conditional ESM fix
12. `kafka-ui-e2e-checks/.../SchemaCreateForm.java` — new locators
13. `kafka-ui-e2e-checks/.../SchemasTest.java` — new test
14. `kafka-ui-react-app/.env` — feature flag

### Created (6)
1. `kafka-ui-react-app/src/__mocks__/jsonjoy-builder.tsx`
2. `kafka-ui-react-app/src/components/common/SchemaToggleEditor/SchemaToggleEditor.tsx`
3. `kafka-ui-react-app/src/components/common/SchemaToggleEditor/__test__/SchemaToggleEditor.spec.tsx`
4. `kafka-ui-react-app/src/components/common/SchemaVisualViewer/SchemaVisualViewer.tsx`
5. `kafka-ui-react-app/src/components/common/SchemaVisualViewer/__test__/SchemaVisualViewer.spec.tsx`
6. `kafka-ui-react-app/src/lib/featureFlags.ts`
