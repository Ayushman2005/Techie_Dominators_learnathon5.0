import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	server: {
		allowedHosts: true,
		proxy: {
			'/api': 'http://127.0.0.1:3001'
		}
	},
	plugins: [
		tailwindcss(),
		sveltekit()
	]
});
