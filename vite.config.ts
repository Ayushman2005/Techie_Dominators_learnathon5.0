import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import path from 'node:path';

export default defineConfig({
	server: {
		allowedHosts: true,
		proxy: {
			'/api': 'http://127.0.0.1:3001'
		}
	},
	resolve: {
		alias: {
			'@': path.resolve(__dirname, './src')
		}
	},
	plugins: [
		tailwindcss(),
		react()
	]
});

