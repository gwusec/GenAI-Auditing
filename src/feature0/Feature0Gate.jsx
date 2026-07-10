// Feature0Gate — landing screen: try the demo, join with a code, or sign in as
// an investigator.
import React, { useState } from 'react';
import { Box, Typography, Stack, Divider } from '../components/ui/layout';
import { Button } from '../components/ui/button';
import { ToggleGroup, ToggleGroupItem } from '../components/ui/toggle-group';
import { Tooltip } from '../components/ui/tooltip';
import {
  Science as ScienceIcon,
  PlayCircle as PlayCircleIcon,
  DarkModeOutlined as DarkModeIcon,
  LightModeOutlined as LightModeIcon,
} from '../components/ui/icons';
import InvestigatorAuth from './InvestigatorAuth';
import AuditorJoin from './AuditorJoin';
import { useFeature0 } from './Feature0Context';
import { useColorMode } from '../theme';

export default function Feature0Gate() {
  const { startDemo } = useFeature0();
  const { mode, toggle: toggleColorMode } = useColorMode();
  const [role, setRole] = useState('auditor');

  return (
    <Box className="relative min-h-screen bg-background px-4 pt-8 sm:pt-16">
      <Tooltip title={mode === 'dark' ? 'Light mode' : 'Dark mode'}>
        <Button variant="ghost" size="icon" onClick={toggleColorMode} className="absolute right-4 top-4">
          {mode === 'dark' ? <LightModeIcon fontSize="small" /> : <DarkModeIcon fontSize="small" />}
        </Button>
      </Tooltip>
      <Stack alignItems="center" spacing={1} className="mb-6">
        <ScienceIcon color="primary" size={44} />
        <Typography variant="h4" align="center" className="font-bold">TRAILS Chatbot Audit</Typography>
        <Typography variant="body1" color="text.secondary" align="center" className="max-w-[480px]">
          Help evaluate AI chatbot responses for fairness, bias, and harm.
        </Typography>
      </Stack>

      {/* Demo CTA */}
      <Box className="mx-auto mb-6 max-w-[420px]">
        <Button
          size="lg" onClick={startDemo} className="w-full rounded-md py-[0.7rem]"
        >
          <PlayCircleIcon />
          Try the demo — no sign-up
        </Button>
        <div className="my-4 flex items-center gap-2 text-xs text-muted-foreground">
          <Divider className="flex-1" />
          <span>or</span>
          <Divider className="flex-1" />
        </div>
      </Box>

      <Box className="mb-2 flex justify-center">
        <ToggleGroup type="single" value={role} onValueChange={(v) => v && setRole(v)}>
          <ToggleGroupItem value="auditor">I have an access code</ToggleGroupItem>
          <ToggleGroupItem value="investigator">I'm an investigator</ToggleGroupItem>
        </ToggleGroup>
      </Box>

      {role === 'auditor' ? <AuditorJoin /> : <InvestigatorAuth />}
    </Box>
  );
}
