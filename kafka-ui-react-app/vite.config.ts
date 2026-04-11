import {
  defineConfig,
  loadEnv,
  UserConfigExport,
  splitVendorChunkPlugin,
} from 'vite';
import react from '@vitejs/plugin-react-swc';
import tsconfigPaths from 'vite-tsconfig-paths';
import { ViteEjsPlugin } from 'vite-plugin-ejs';

export default defineConfig(({ mode }) => {
  process.env = { ...process.env, ...loadEnv(mode, process.cwd()) };

  const mockBackendPlugin = {
    name: 'mock-backend',
    configureServer(server: any) {
      server.middlewares.use((req: any, res: any, next: any) => {
        if (req.url === '/actuator/info') {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ build: { version: 'dev' } }));
          return;
        }
        if (req.url === '/api/info') {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({
            build: { version: 'dev', buildTime: Date.now(), commitId: 'dev', isLatestRelease: true },
            latestRelease: { versionTag: 'dev' },
          }));
          return;
        }
        if (req.url === '/api/clusters') {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify([{ name: 'local', status: 'online', readOnly: false, features: ['SCHEMA_REGISTRY', 'KAFKA_CONNECT', 'KSQL_DB', 'TOPIC_DELETION'] }]));
          return;
        }
        // Schema fixtures
        const JSON_SCHEMA = JSON.stringify({
          $schema: 'http://json-schema.org/draft-07/schema#',
          title: 'UserEvent',
          type: 'object',
          properties: {
            userId: { type: 'string', description: 'Unique user identifier' },
            eventType: { type: 'string', enum: ['login', 'logout', 'purchase'] },
            timestamp: { type: 'integer', description: 'Unix timestamp' },
            sessionId: { type: 'string', description: 'Browser session ID' },
            metadata: { type: 'object', additionalProperties: { type: 'string' } },
          },
          required: ['userId', 'eventType', 'timestamp'],
        });
        const AVRO_SCHEMA = JSON.stringify({ type: 'record', name: 'PageView', namespace: 'com.example', fields: [{ name: 'url', type: 'string' }, { name: 'userId', type: ['null', 'string'], default: null }] });
        const mockSchemas = [
          { subject: 'user-events-json', version: 2, id: 1, schema: JSON_SCHEMA, schemaType: 'JSON', compatibilityLevel: 'BACKWARD' },
          { subject: 'page-views-avro', version: 1, id: 2, schema: AVRO_SCHEMA, schemaType: 'AVRO', compatibilityLevel: 'BACKWARD' },
        ];

        // GET /api/clusters/local/schemas
        if (req.url === '/api/clusters/local/schemas') {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(mockSchemas));
          return;
        }
        // GET /api/clusters/local/schemas/*/latest
        const latestMatch = req.url?.match(/^\/api\/clusters\/local\/schemas\/([^/]+)\/latest$/);
        if (latestMatch && req.method === 'GET') {
          const subject = decodeURIComponent(latestMatch[1]);
          const schema = mockSchemas.find(s => s.subject === subject) || mockSchemas[0];
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(schema));
          return;
        }
        // GET /api/clusters/local/schemas/*/versions
        const versionsMatch = req.url?.match(/^\/api\/clusters\/local\/schemas\/([^/]+)\/versions$/);
        if (versionsMatch && req.method === 'GET') {
          const vSubject = decodeURIComponent(versionsMatch[1]);
          const baseSchema = mockSchemas.find(s => s.subject === vSubject) || mockSchemas[0];
          const versions = [
            { ...baseSchema, version: 1, id: (baseSchema.id * 10) + 1 },
            { ...baseSchema, version: 2, id: (baseSchema.id * 10) + 2 },
          ];
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(versions));
          return;
        }
        // GET /api/clusters/local/schemas/*/versions/:version
        const versionMatch = req.url?.match(/^\/api\/clusters\/local\/schemas\/([^/]+)\/versions\/(\d+)$/);
        if (versionMatch && req.method === 'GET') {
          const subject = decodeURIComponent(versionMatch[1]);
          const schema = mockSchemas.find(s => s.subject === subject) || mockSchemas[0];
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ ...schema, version: Number(versionMatch[2]) }));
          return;
        }
        // GET compatibility
        if (req.url?.includes('/schemas/compatibility')) {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ compatibility: 'BACKWARD' }));
          return;
        }

        if (req.url?.startsWith('/api/')) {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({}));
          return;
        }
        next();
      });
    },
  };

  const defaultConfig: UserConfigExport = {
    plugins: [
      react(),
      tsconfigPaths(),
      splitVendorChunkPlugin(),
      ViteEjsPlugin({
        PUBLIC_PATH: mode !== 'development' ? 'PUBLIC-PATH-VARIABLE' : '',
      }),
      mockBackendPlugin,
    ],
    server: {
      port: 3000,
    },
    optimizeDeps: {
      include: ['react-dom', 'ajv', 'ajv-formats', '@monaco-editor/react'],
    },
    build: {
      outDir: 'build',
      rollupOptions: {
        output: {
          manualChunks: {
            ace: ['ace-builds', 'react-ace'],
            jsonjoy: ['jsonjoy-builder', '@monaco-editor/react', 'monaco-editor'],
          },
        },
      },
    },
    experimental: {
      renderBuiltUrl(
        filename: string,
        {
          hostType,
        }: {
          hostId: string;
          hostType: 'js' | 'css' | 'html';
          type: 'asset' | 'public';
        }
      ) {
        if (hostType === 'js') {
          return {
            runtime: `window.__assetsPathBuilder(${JSON.stringify(filename)})`,
          };
        }

        return filename;
      },
    },
    define: {
      'process.env.NODE_ENV': `"${mode}"`,
      'process.env.VITE_TAG': `"${process.env.VITE_TAG}"`,
      'process.env.VITE_COMMIT': `"${process.env.VITE_COMMIT}"`,
    },
  };
  const proxy = process.env.VITE_DEV_PROXY;
  if (mode === 'development' && proxy) {
    return {
      ...defaultConfig,
      server: {
        ...defaultConfig.server,
        open: true,
        proxy: {
          '/api': {
            target: proxy,
            changeOrigin: true,
            secure: false,
          },
          '/actuator/info': {
            target: proxy,
            changeOrigin: true,
            secure: false,
          },
        },
      },
    };
  }

  return defaultConfig;
});
