// InvestigatorAuth — login / sign-up form for investigators.
import React, { useState } from 'react';
import { Box, Typography } from '../components/ui/layout';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Alert } from '../components/ui/alert';
import { Card } from '../components/ui/card';
import { useFeature0 } from './Feature0Context';

export default function InvestigatorAuth() {
  const { signIn, signUp } = useFeature0();
  const [mode, setMode] = useState('signin'); // 'signin' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError(null); setBusy(true);
    try {
      if (mode === 'signin') await signIn({ email, password });
      else await signUp({ email, password, displayName });
    } catch (err) {
      setError(err.message || 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="mx-auto mt-12 max-w-[420px] rounded-xl p-8">
      <Typography variant="h6" gutterBottom>Investigator access</Typography>
      <Tabs value={mode} onValueChange={setMode} className="mb-4">
        <TabsList>
          <TabsTrigger value="signin">Sign in</TabsTrigger>
          <TabsTrigger value="signup">Create account</TabsTrigger>
        </TabsList>
      </Tabs>
      {error && <Alert variant="destructive" className="mb-4">{error}</Alert>}
      <Box component="form" onSubmit={submit} className="flex flex-col gap-4">
        {mode === 'signup' && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="inv-name">Name</Label>
            <Input id="inv-name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          </div>
        )}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="inv-email">Email</Label>
          <Input id="inv-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="inv-password">Password</Label>
          <Input id="inv-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        <Button type="submit" disabled={busy}>
          {mode === 'signin' ? 'Sign in' : 'Create account'}
        </Button>
      </Box>
    </Card>
  );
}
