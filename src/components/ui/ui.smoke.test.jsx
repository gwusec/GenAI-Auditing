import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import { Button } from './button';
import { Input } from './input';
import { Textarea } from './textarea';
import { Label } from './label';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from './card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './dialog';
import { Alert, AlertTitle, AlertDescription } from './alert';
import { Badge } from './badge';
import { Separator } from './separator';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './tabs';
import { Tooltip } from './tooltip';
import { Checkbox } from './checkbox';
import { Switch } from './switch';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from './select';
import { RadioGroup, RadioGroupItem } from './radio-group';
import { ToggleGroup, ToggleGroupItem } from './toggle-group';
import { Avatar, AvatarFallback } from './avatar';
import { Progress } from './progress';
import { Spinner } from './spinner';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from './table';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from './accordion';
import { Box, Stack, Grid, Typography, Divider, List, ListItem } from './layout';
import * as Icons from './icons';

test('all ui primitives import and render without throwing', () => {
  renderToStaticMarkup(
    <div>
      <Button>b</Button>
      <Input />
      <Textarea />
      <Label>l</Label>
      <Card><CardHeader><CardTitle>t</CardTitle></CardHeader><CardContent>c</CardContent><CardFooter>f</CardFooter></Card>
      <Alert variant="destructive"><AlertTitle>t</AlertTitle><AlertDescription>d</AlertDescription></Alert>
      <Badge variant="success">x</Badge>
      <Separator />
      <Tabs defaultValue="a"><TabsList><TabsTrigger value="a">a</TabsTrigger></TabsList><TabsContent value="a">c</TabsContent></Tabs>
      <Tooltip title="hi"><button>t</button></Tooltip>
      <Checkbox />
      <Switch />
      <Select><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="a">a</SelectItem></SelectContent></Select>
      <RadioGroup><RadioGroupItem value="a" /></RadioGroup>
      <ToggleGroup type="single"><ToggleGroupItem value="a">a</ToggleGroupItem></ToggleGroup>
      <Avatar><AvatarFallback>A</AvatarFallback></Avatar>
      <Progress value={50} />
      <Spinner />
      <Table><TableHeader><TableRow><TableHead>h</TableHead></TableRow></TableHeader><TableBody><TableRow><TableCell>c</TableCell></TableRow></TableBody></Table>
      <Accordion type="single" collapsible><AccordionItem value="a"><AccordionTrigger>a</AccordionTrigger><AccordionContent>c</AccordionContent></AccordionItem></Accordion>
      <Box><Stack direction="row" spacing={2} alignItems="center"><span>s</span></Stack></Box>
      <Grid container spacing={2}><Grid item xs={12} sm={6}>g</Grid></Grid>
      <Typography variant="h2" color="text.secondary" align="center" gutterBottom>ty</Typography>
      <Divider />
      <List><ListItem>i</ListItem></List>
      <DialogFooter><Icons.Add /><Icons.Close /><Icons.Science /><Icons.Memory /></DialogFooter>
    </div>,
  );
  expect(true).toBe(true);
});
