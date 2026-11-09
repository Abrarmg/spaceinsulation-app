import React from 'react';
import { LoginForm } from '../components/layout/LoginForm';

export const LoginAdmin: React.FC = () => (
  <LoginForm
    title="Office sign in"
    subtitle="Welcome back. Sign in to manage leads, jobs and invoices."
    defaultRedirect="/"
    emailPlaceholder="you@spaceinsulation.com"
    switchPrompt="Field technician?"
    switchLabel="Use the worker sign in"
    switchTo="/login/worker"
    logLabel="Admin"
  />
);
