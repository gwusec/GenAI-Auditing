// StudyDashboard — investigator home. Lists studies as cards, creates new ones,
// and navigates into StudySetup for configuration. Also lets an investigator
// take/preview studies they're an auditor on.

import React, { useCallback, useEffect, useState } from 'react';
import { Typography, Box, Stack, Grid, Divider } from '../components/ui/layout';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardFooter } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Avatar, AvatarFallback } from '../components/ui/avatar';
import { Tooltip } from '../components/ui/tooltip';
import {
  Add as AddIcon, Settings as SettingsIcon, PlayArrow as PlayArrowIcon,
  BarChart as BarChartIcon, Science as ScienceIcon,
  DarkModeOutlined as DarkModeIcon, LightModeOutlined as LightModeIcon, Close,
} from '../components/ui/icons';
import { useFeature0 } from './Feature0Context';
import StudySetup from './StudySetup';
import StudyData from './StudyData';
import { validateStudyConfig, withStudyConfigDefaults } from '../tools/studyConfig';
import { useColorMode } from '../theme';

export default function StudyDashboard() {
  const { user, studies, signOut, previewStudy } = useFeature0();
  const { mode, toggle: toggleColorMode } = useColorMode();
  const [list, setList] = useState([]);
  const [title, setTitle] = useState('');
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null); // study being configured
  const [viewingData, setViewingData] = useState(null); // study whose data is being viewed

  const refresh = useCallback(async () => {
    if (!user) return;
    try {
      setList(await studies.listStudiesForUser(user.id));
    } catch (err) {
      setError(err.message);
    }
  }, [studies, user]);

  useEffect(() => { refresh(); }, [refresh]);

  const createStudy = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      const study = await studies.createStudy(user.id, { title: title.trim() });
      setTitle('');
      await refresh();
      setSelected(study); // jump straight into setup
    } catch (err) {
      setError(err.message);
    }
  };

  if (selected) {
    return <StudySetup study={selected} onBack={() => { setSelected(null); refresh(); }} />;
  }

  if (viewingData) {
    return <StudyData study={viewingData} onBack={() => setViewingData(null)} />;
  }

  return (
    <Box className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 bg-primary text-primary-foreground shadow-sm">
        <div className="flex min-h-[64px] items-center px-6">
          <ScienceIcon className="mr-3 text-primary" />
          <Typography variant="h6" className="grow font-bold tracking-[-0.01em]">TRAILS</Typography>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Tooltip title={mode === 'dark' ? 'Light mode' : 'Dark mode'}>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-inherit hover:bg-white/10" onClick={toggleColorMode}>
                {mode === 'dark' ? <LightModeIcon fontSize="small" /> : <DarkModeIcon fontSize="small" />}
              </Button>
            </Tooltip>
            <Avatar className="h-[30px] w-[30px]">
              <AvatarFallback className="bg-primary-dark text-[14px] text-primary-foreground">
                {(user?.email || user?.displayName || '?').charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <Typography variant="body2" className="opacity-90">{user?.email || user?.displayName}</Typography>
            <Button variant="ghost" size="sm" className="text-inherit hover:bg-white/10" onClick={signOut}>Sign out</Button>
          </Stack>
        </div>
      </header>

      <Box className="mx-auto max-w-[900px] px-6 py-8">
        {error && (
          <Alert variant="destructive" className="mb-4">
            <div className="flex items-start justify-between gap-2">
              <AlertDescription>{error}</AlertDescription>
              <Button variant="ghost" size="icon" className="-mr-1 -mt-1 h-6 w-6 shrink-0" onClick={() => setError(null)}>
                <Close />
              </Button>
            </div>
          </Alert>
        )}

        <Card className="mb-8 p-6">
          <Typography variant="subtitle1" className="mb-3 font-semibold">Create a new study</Typography>
          <Box as="form" onSubmit={createStudy} className="flex gap-4">
            <Input
              placeholder="e.g. Fairness audit — customer support bot"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <Button type="submit" disabled={!title.trim()} className="whitespace-nowrap">
              <AddIcon />
              Create &amp; set up
            </Button>
          </Box>
        </Card>

        <Typography variant="h6" className="mb-4 font-semibold">Your studies</Typography>

        {list.length === 0 ? (
          <Card className="border-dashed p-10 text-center">
            <ScienceIcon size={40} className="mx-auto mb-2 text-muted-foreground opacity-50" />
            <Typography color="text.secondary">No studies yet. Create your first one above.</Typography>
          </Card>
        ) : (
          <Grid container spacing={2}>
            {list.map((s) => {
              const isInvestigator = s.roles.includes('investigator');
              // A study is "ready" to run/preview when its config is valid (model set).
              // The questionnaire is optional (SC-6), so don't gate on it.
              const configured = validateStudyConfig(withStudyConfigDefaults(s.config || {})).valid;
              return (
                <Grid item xs={12} sm={6} key={s.id}>
                  <Card className="flex h-full flex-col">
                    <CardContent className="grow pt-6">
                      <Stack direction="row" spacing={1} className="mb-2">
                        {s.roles.map((r) => (
                          <Badge key={r} variant={r === 'investigator' ? 'default' : 'outline'}>{r}</Badge>
                        ))}
                        {isInvestigator && (
                          <Badge variant={configured ? 'success' : 'warning'}>
                            {configured ? 'Ready' : 'Needs setup'}
                          </Badge>
                        )}
                      </Stack>
                      <Typography variant="h6" className="font-semibold">{s.title}</Typography>
                      {s.description && (
                        <Typography variant="body2" color="text.secondary" className="mt-1">{s.description}</Typography>
                      )}
                    </CardContent>
                    <Divider />
                    <CardFooter className="gap-2 px-4 py-3">
                      {isInvestigator && (
                        <Button variant="ghost" size="sm" onClick={() => setSelected(s)}>
                          <SettingsIcon />
                          Set up
                        </Button>
                      )}
                      {isInvestigator && (
                        <Button variant="ghost" size="sm" onClick={() => setViewingData(s)}>
                          <BarChartIcon />
                          Data
                        </Button>
                      )}
                      <Button
                        variant="ghost" size="sm"
                        onClick={() => previewStudy(s)}
                        disabled={isInvestigator && !configured}
                      >
                        <PlayArrowIcon />
                        {isInvestigator ? 'Preview' : 'Take study'}
                      </Button>
                    </CardFooter>
                  </Card>
                </Grid>
              );
            })}
          </Grid>
        )}
      </Box>
    </Box>
  );
}
