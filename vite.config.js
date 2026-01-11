import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
    build: {
        lib: {
            entry: resolve(__dirname, 'src/index.js'),
            name: 'TrapAlert',
            formats: ['umd', 'es'],
            fileName: (format) => `trapalert.${format}.js`
        },
        rollupOptions: {
            output: {
                exports: 'named',
                // Ensure UMD bundle works in all environments
                globals: {}
            }
        },
        sourcemap: true,
        minify: 'terser',
        terserOptions: {
            compress: {
                drop_console: false // Keep console logs for debugging
            }
        }
    },
    server: {
        open: '/demo.html'
    }
});
