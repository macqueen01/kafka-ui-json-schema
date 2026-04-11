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
          res.end(JSON.stringify([]));
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
