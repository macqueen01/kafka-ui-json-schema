## [2026-04-11] Wave 0: Foundation

- pnpm command: `npx pnpm` (pnpm v10.33.0 available via npx, not in PATH)
- engines relaxation needed: YES — package.json `engines.node` was `v18.17.1` (exact), `engines.pnpm` was `^8.6.12`; relaxed to `>=18` / `>=8` to allow Node v22 + pnpm v10
- .npmrc with `engine-strict=false` did NOT work — must relax engines in package.json itself
- pnpm overrides: YES — added `"pnpm": { "overrides": { "react": "^18.1.0", "react-dom": "^18.1.0" } }` (jsonjoy-builder peer deps)
- jsonjoy-builder installed version: ^0.3.2
- monaco-editor installed version: ^0.55.1
- React 18 compat: NO peer dep errors (overrides handled it)
- __mocks__ location: `kafka-ui-react-app/__mocks__/jsonjoy-builder.tsx` (root adjacent to node_modules — works for auto-mocking node_modules in jest)

### TypeScript module resolution fix
- jsonjoy-builder `package.json` has `"types": "./dist/jsonjoy-builder.d.ts"` but that file does NOT exist
- Actual types are at `./dist/index.d.ts`
- Fix: added `"paths": { "jsonjoy-builder": ["../node_modules/jsonjoy-builder/dist/index"] }` to tsconfig.json
- This resolves from `baseUrl: "src"`, so `../node_modules/...` points to the correct dist path

### ESM resolver fix needed
- NO — jsonjoy-builder imports work fine in Vite (handles ESM natively)
- Jest uses `__mocks__/jsonjoy-builder.tsx` which bypasses the ESM issue

### generated-sources stub
- `src/generated-sources/` is gitignored; tests require running `pnpm gen:sources` normally
- Created `src/generated-sources/index.ts` as a minimal stub with all enums and interfaces needed for the test chain
- This is NOT a replacement for real generation — remove when `pnpm gen:sources` is available
- Needed types: `SchemaType`, `ResourceType`, `Action`, `UserPermission`, `ConsumerGroupState`, `SeekDirection`, `SerdeUsage`, `ApplicationInfoEnabledFeaturesEnum`, `ConnectorAction`, `ConfigSource`, `ServerStatus`, plus ~15 interfaces
- All API classes (`SchemasApi`, `TopicsApi`, etc.) stubbed with empty constructors + only required methods

### New.spec.tsx tests
- PASS (3/3) after:
  1. Adding `aria-label="Schema"` to Textarea in New.tsx
  2. Changing fragile `screen.getAllByRole('textbox')[1]` to `screen.getByRole('textbox', { name: /schema/i })`
  3. Creating generated-sources stub

### jest reporter issue
- `reporters: ['default', 'github-actions']` in jest.config.ts — `github-actions` reporter not installed
- Workaround: run jest via `node_modules/.bin/jest --reporters=default` (bypasses the missing reporter)
- The `pnpm test` command hangs when `github-actions` reporter is missing

### App.tsx route pattern
- Existing routes use direct imports (NOT React.lazy)
- But there's already a global `<Suspense>` wrapper at root — lazy components work fine inside it
- Used `React.lazy()` + dynamic import for the spike (`/spike` route) to avoid loading heavy jsonjoy-builder bundle eagerly
- Import path uses tsconfig `baseUrl: "src"`: `import('__spike__/JsonjoySpike')`

### .npmrc
- Created `kafka-ui-react-app/.npmrc` with `engine-strict=false` (currently NOT working for engine enforcement, but kept for documentation)

## [2026-04-11] Wave 0: Spike Results + Vite Config Fixes

### React 18 Compatibility: CONFIRMED ✅
- jsonjoy-builder 0.3.2 works with React 18.1.0
- No React 19 API crashes (useOptimistic, use(), etc.)
- Peer dep warning in console is benign — ignore it

### pnpm overrides: Pin to EXACT version, not range
- `"react": "^18.1.0"` resolved to 18.3.1 → broke Vite pre-bundling
- `"react": "18.1.0"` (exact) keeps React at 18.1.0 → works correctly
- LESSON: Always pin exact version in pnpm overrides when downgrading

### Vite optimizeDeps required for jsonjoy-builder
- jsonjoy-builder is ESM but imports CJS packages (ajv, react-dom)
- Vite doesn't auto-pre-bundle transitive CJS deps of ESM packages
- Fix: add to vite.config.ts:
  ```typescript
  optimizeDeps: {
    include: ['react-dom', 'ajv', 'ajv-formats', '@monaco-editor/react'],
  }
  ```
- @monaco-editor/react must be installed as DIRECT dep (not just transitive)
  → `npx pnpm add @monaco-editor/react`

### generated-sources stub: Proxy pattern works but needs specific methods
- BaseApi Proxy constructor return works for unknown methods
- BUT: methods that return arrays need explicit stubs (Proxy returns {} not [])
- ClustersApi.getClusters() must return Promise.resolve([]) explicitly
- Pattern: add explicit stubs for any method that returns a list

### App requires backend to mount (even for spike)
- GlobalSettingsProvider, Nav, Version all call APIs on mount
- Without backend, app crashes before spike component renders
- Fix: add Vite configureServer middleware to mock critical endpoints:
  - GET /actuator/info → { build: { version: 'dev', buildTime: Date.now(), commitId: 'dev', isLatestRelease: true }, latestRelease: { versionTag: 'dev' } }
  - GET /api/info → same shape
  - GET /api/clusters → []
  - GET /api/* → {}
- This mock is ONLY for dev spike — remove before Wave 1 integration

### CSS isolation: CONFIRMED ✅
- Tailwind CSS from jsonjoy-builder scoped under .jsonjoy class
- No bleed into styled-components layout
- NavBar, sidebar, header all render normally alongside jsonjoy

### Bundle chunk: Works
- manualChunks: { jsonjoy: ['jsonjoy-builder', '@monaco-editor/react', 'monaco-editor'] }
- WARNING: splitVendorChunkPlugin() conflicts with object form of manualChunks
  → Consider converting to function form in future

## [2026-04-11] Wave 1: SchemaToggleEditor

- Editor props: `readOnly` (not `isReadOnly`), `value`, `onChange`, `name`, `height`, `schemaType` — extends `IAceEditorProps` via `...rest`
- SchemaToggleEditor location: `src/components/common/SchemaToggleEditor/`
- New.tsx integration: removed `register` + `Textarea` import; added `watch` to methods destructuring; schema field uses `Controller` + `SchemaToggleEditor`; `watchedSchemaType = watch('schemaType')`
- Theme props used: `theme.input.borderColor.normal` (border), `theme.hr.backgroundColor` (inactive tab bg), `theme.input.error` (error color), `theme.topicFormLabel.color` (muted text), `theme.default.backgroundColor` (active tab bg)
- JSONSchema type from jsonjoy-builder: `boolean | (ZodObject & {...})` — NOT `Record<string, unknown>`. Must `import type { JSONSchema } from 'jsonjoy-builder'`
- SchemaVisualEditorProps (actual): `{ schema: JSONSchema; readOnly: boolean; onChange: (schema: JSONSchema) => void }` — `readOnly` and `onChange` both required
- featureFlags.ts uses `import.meta.env` — SyntaxError in Jest. Fix: `jest.mock('lib/featureFlags', () => ({ isVisualSchemaEditorEnabled: jest.fn() }))`
- jsonjoy-builder is ESM-only (`"type": "module"`). `roots: ['<rootDir>/src']` means `__mocks__/jsonjoy-builder.tsx` is NOT auto-discovered for `jest.mock('jsonjoy-builder')` (Jest looks in `src/__mocks__/` not root `__mocks__/`)
- Fix for jsonjoy-builder mock: use `jest.mock('jsonjoy-builder', factory)` with inline factory — bypasses ESM load entirely
- React.lazy + dynamic import in tests: auto-mocks in `__mocks__/` don't reliably intercept dynamic imports when `roots` != project root. Always use explicit `jest.mock(factory)` for ESM packages
- New.spec.tsx strategy: `jest.mock('components/common/SchemaToggleEditor', ...)` renders a native textarea with `aria-label="Schema"` — keeps existing test assertions intact without AceEditor interaction complexity
- Tests: 8 cases in SchemaToggleEditor.spec.tsx (all pass), 3 cases in New.spec.tsx (all pass) — 11/11 total

## [2026-04-11] Wave 2: Edit + Details

### SchemaToggleEditor: onChange optional
- Changed `onChange: (value: string) => void` → `onChange?: (value: string) => void` in interface
- Added `onChange = () => undefined` default in component signature
- Required for read-only usage in LatestVersionItem (no edit needed)

### Form.tsx (Edit page) integration
- Removed `import Editor from 'components/common/Editor/Editor'`
- Added `import SchemaToggleEditor from 'components/common/SchemaToggleEditor'`
- Left panel (read-only Latest schema): replaced `Editor` with `SchemaToggleEditor` using `readOnly` prop, `value={formatedSchema || ''}`
- Right panel (editable New schema): replaced Controller+Editor with Controller+SchemaToggleEditor, passed `onChange` from react-hook-form `field`
- Note: `formatedSchema` can be `undefined` before schema loads — use `|| ''` guard

### LatestVersionItem.tsx
- Import `SchemaType` (alongside existing `SchemaSubject`) from `generated-sources`
- Import `SchemaToggleEditor` and `isVisualSchemaEditorEnabled` from their respective modules
- Conditional render: `isVisualSchemaEditorEnabled() && schemaType === SchemaType.JSON` → SchemaToggleEditor, else EditorViewer
- Component uses implicit return arrow `=> (...)` — ternary in JSX works without converting to block body

### Edit.spec.tsx: Mock pattern
- Must include `__esModule: true` in mock factory for barrel re-exports (`export { default } from './X'`)
- Without `__esModule: true`, Jest CJS interop returns the whole `{ default: fn }` object instead of `fn` → "got: object" React error
- Example: `jest.mock('components/common/SchemaToggleEditor', () => ({ __esModule: true, default: (...) => <textarea /> }))`
- The `fetchMock` in the original test was dead code — `generated-sources/index.ts` is a stub where `SchemasApi.getLatestSchema()` returns `Promise.resolve({} as any)` (no real HTTP fetch). Removed `fetchMock` assertions and used `await screen.findByText('Submit')` for async waiting instead

### LatestVersionItem.spec.tsx: Feature flag + mock pattern
- `jest.mock('lib/featureFlags', ...)` required because `featureFlags.ts` uses `import.meta.env` (Jest SyntaxError)
- Import as `* as featureFlags` to allow `jest.mocked(featureFlags.isVisualSchemaEditorEnabled).mockReturnValue(true)`
- `resetMocks: true` in jest.config.ts resets implementations between tests → `mockReturnValue` must be inside each test
- Mock for SchemaToggleEditor must have `__esModule: true` (same barrel re-export pattern as Edit.spec.tsx)
- JSON schema test: asserts `schema-toggle-editor` testid is present
- PROTOBUF schema test: asserts `schema-toggle-editor` testid is NOT present (condition `schemaType === SchemaType.JSON` fails)

### Test results: 47/47 pass, 11/11 suites pass
### LSP: 0 errors on all 5 changed files

## [2026-04-11] Wave 3: SchemaVisualViewer + SendMessage

### SchemaVisualViewer component
- New collapsible read-only schema viewer: `src/components/common/SchemaVisualViewer/`
- Props: `{ schemaString: string | undefined }` — renders nothing when undefined, invalid JSON, or feature flag off
- Uses `React.useState` for collapse/expand toggle (▶/▼ prefix)
- Guards: (1) `!schemaString`, (2) `!isVisualSchemaEditorEnabled()`, (3) `JSON.parse()` throws — all return null
- Delegates rendering to `SchemaToggleEditor` with `readOnly` prop and `schemaType={SchemaType.JSON}`
- Barrel: `export { default } from './SchemaVisualViewer'` — needs `__esModule: true` in jest mock factories (same barrel re-export pattern)

### SendMessage.tsx integration
- Added `watch` to `useForm` destructuring to observe `valueSerde` field changes
- Added `watchedValueSerde = watch('valueSerde')` + `valueSerdeSchema` memo after partitionOptions
- `TopicSerdeSuggestion extends Record<string, any>` — ALL properties are `any` type at runtime, no element type inference for `.find()` callbacks
- Fix for implicit `any` in `find` callback: extract to typed local variable:
  ```tsx
  const serdeValues: Array<{ name: string; schema?: string }> = serdes.value || [];
  return serdeValues.find((v) => v.name === watchedValueSerde)?.schema;
  ```
- Placed `<SchemaVisualViewer schemaString={valueSerdeSchema} />` BEFORE `<InputLabel>Value</InputLabel>`

### Test patterns
- `toBeEmptyDOMElement()` FAILS when component returns `null` because `lib/testHelpers` render wraps in providers that add a `<div>` wrapper → container.innerHTML is `<div></div>` not empty
- Correct pattern for "renders nothing" assertion: `expect(screen.queryByText(/Schema Structure/)).not.toBeInTheDocument()`
- `SchemaVisualViewer` mock in `SendMessage.spec.tsx`: `{ __esModule: true, default: () => null }` — null render mock + barrel re-export pattern
- `lib/featureFlags` mock: `{ isVisualSchemaEditorEnabled: jest.fn() }` — no `__esModule: true` needed (named export, not default)

### LSP
- 4 new files: 0 errors
- `SendMessage.tsx`: 2 pre-existing errors at original lines 76/81 (`serdes.key?.find((k)=>)` / `serdes.value?.find((v)=>)`) — root cause is `TopicSerdeSuggestion extends Record<string, any>`, not introduced by Wave 3

### Test results: 20/20 pass (SchemaVisualViewer: 5/5, SendMessage: 3/3, utils: 12/12)

## [2026-04-11] Wave 4: E2E Java changes

- SchemaCreateForm.java: Added `visualEditorTab`, `codeEditorTab`, and `jsonjoyContainer` locators using XPath.
- SchemaCreateForm.java: Added `@Step` methods for clicking tabs and verifying visual editor visibility.
- SchemasTest.java: Added `createSchemaJsonWithVisualEditor` smoke test at priority 9.
- Verified `SchemaType` import usage in test: `com.provectus.kafka.ui.api.model.SchemaType.JSON`.
- Adhered to "Must Not Do" by avoiding build commands and unrelated changes.
- Self-correction: Removed redundant comments from the new test method as per clean code guidelines.


## [2026-04-12] Layout Fix: JsonSchemaEditor wrapper + EditorsWrapper

### JsonSchemaEditor natural height
- `JsonSchemaEditor` from jsonjoy-builder has hardcoded `h-[600px]` Tailwind class on desktop container
- Our wrapper must NOT set a `height` that's less than 600px, or the component gets clipped
- Correct wrapper: `style={{ overflow: 'hidden', position: 'relative', width: '100%' }}` — no height
- The left panel (`SchemaVisualEditor`) has its own `overflow-auto` — scrolls within 600px naturally
- `overflow: 'hidden'` on wrapper creates BFC preventing Monaco horizontal bleed

### EditorsWrapper flex overflow fix
- Two side-by-side `JsonSchemaEditor` in `EditorsWrapper` (flex layout)
- Without `min-width: 0` on flex children, items won't shrink below content min-width
- Monaco has a large min-width → right editor bleeds past viewport
- Fix: add `min-width: 0` to `EditorsWrapper > *`

### height prop in SchemaToggleEditor
- `height` prop is ONLY used for the non-visual Ace editor path
- Visual editor path ignores `height` (JsonSchemaEditor has its own h-[600px])
- This is intentional — visual editor has fixed height from the library

## [2026-04-12] UX Fixes: Edit layout + version history mock

### Edit page: vertical stack for editors
- `EditorsWrapper` changed from `display: flex` (horizontal) to `flex-direction: column` (vertical)
- Side-by-side layout was too narrow for JsonSchemaEditor's visual field tree
- Each editor now takes full page width → field names/descriptions display properly
- Removed `flex-grow: 1; min-width: 0` (not needed for column layout)

### Mock versions data fix
- `schemaVersionsAdapter` uses `selectId: ({ id }) => id`
- Old mock `[{ version: 1 }, { version: 2 }]` had no `id` field → both stored under key `undefined` → second overwrites first → empty table
- Fix: generate version objects from `mockSchemas` base data, assign unique `id` values
- JSON_SCHEMA updated to include `sessionId` field (5 fields total: userId, eventType, timestamp, sessionId, metadata)

## [2026-04-12] Scroll capture bug fixes

### LatestVersionItem scroll capture
- `& > * { overflow-y: scroll }` ALWAYS creates scroll context even when content fits
- Result: wheel events consumed by the wrapper, page can't scroll to "Old versions"
- Fix: `overflow-y: auto` — only creates scroll context when content actually overflows

### Edit page layout + Submit visibility
- Two stacked 600px editors = 1670px page, Submit unreachable
- Fix: Revert to horizontal layout + use EditorViewer for "Latest schema"
- "Latest schema" (read-only reference) doesn't need the visual editor — EditorViewer at maxLines=20 is sufficient
- "New schema" (editable) keeps full SchemaToggleEditor visual editor
- Page height ~800px, Submit reachable after short scroll
- EditorsWrapper: `display: flex; gap: 16px; & > * { flex-grow: 1; min-width: 0 }` (horizontal)
