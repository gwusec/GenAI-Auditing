import * as React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';

// Spinner — replaces MUI CircularProgress. `size` is a pixel diameter (matching
// the common MUI `size={20}` usage); defaults to 20px.
const Spinner = React.forwardRef(({ className, size = 20, style, ...props }, ref) => (
  <Loader2
    ref={ref}
    className={cn('animate-spin text-primary', className)}
    style={{ width: size, height: size, ...style }}
    {...props}
  />
));
Spinner.displayName = 'Spinner';

export { Spinner };
