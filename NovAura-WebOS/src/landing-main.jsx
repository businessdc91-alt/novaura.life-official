/**
 * Landing Page Entry Point
 * Standalone search engine for novaura.life
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import { Toaster } from './components/ui/sonner';
import { AuthProvider, useAuth } from './hooks/useAuth';
import './index.css';

// Standalone landing page (no OS)
function LandingAppContent() {
  const { user, isAuthenticated } = useAuth();
  
  return (
    <BrowserRouter>
      <LandingPage 
        onLaunchOS={() => {
          window.location.href = '/os/';
        }}
        isAuthenticated={isAuthenticated}
      />
      <Toaster position="top-right" />
    </BrowserRouter>
  );
}

function LandingApp() {
  return (
    <AuthProvider>
      <LandingAppContent />
    </AuthProvider>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <LandingApp />
  </React.StrictMode>
);
