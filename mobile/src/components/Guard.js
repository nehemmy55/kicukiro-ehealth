// Shows a friendly message if a role opens a screen it may not use.
import React from 'react';
import { useAuth } from '../lib/auth';
import { Card, Empty, Screen } from './ui';

export default function Guard({ roles, children }) {
  const { user } = useAuth();
  if (!user || !roles.includes(user.role)) {
    return <Screen><Card><Empty title="Access restricted" text="Your role does not have access to this module." /></Card></Screen>;
  }
  return children;
}
