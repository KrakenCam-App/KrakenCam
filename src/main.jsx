import React from 'react'
import ReactDOM from 'react-dom/client'
import { AuthProvider } from './components/AuthProvider.jsx'
import AppRouter from './AppRouter.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <AppRouter />
    </AuthProvider>
  </React.StrictMode>
)
