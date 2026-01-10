import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load các biến môi trường từ file .env
  const env = loadEnv(mode, (process as any).cwd(), '');
  
  return {
    plugins: [react()],
    define: {
      // Định nghĩa process.env để code cũ hoạt động bình thường trên Vite
      'process.env.API_KEY': JSON.stringify(env.API_KEY),
      // Polyfill cho process.env nếu cần các biến khác
      'process.env': JSON.stringify(env)
    },
    server: {
      port: 5173,
      open: true // Tự động mở trình duyệt khi chạy npm run dev
    }
  }
})