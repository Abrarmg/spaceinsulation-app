import React from 'react';
import { LoginForm } from '../components/layout/LoginForm';

export const LoginWorker: React.FC = () => (
  <LoginForm
    title="Crew sign in"
    subtitle="Sign in to see today's jobs and clock in."
    defaultRedirect="/worker-dashboard"
    emailPlaceholder="you@example.com"
    switchPrompt="Office staff?"
    switchLabel="Use the office sign in"
    switchTo="/login/admin"
    logLabel="Worker"
  />
);
