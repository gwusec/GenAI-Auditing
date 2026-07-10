import * as React from 'react';
import * as ProgressPrimitive from '@radix-ui/react-progress';
import { cn } from '../../lib/utils';

// Progress — replaces MUI LinearProgress. `value` is a 0–100 percentage.
// When value is null/undefined it renders an indeterminate sweeping bar.
const Progress = React.forwardRef(({ className, value, indicatorClassName, ...props }, ref) => {
  const isIndeterminate = value === null || value === undefined;
  return (
    <ProgressPrimitive.Root
      ref={ref}
      value={isIndeterminate ? undefined : value}
      className={cn('relative h-2 w-full overflow-hidden rounded-full bg-primary/20', className)}
      {...props}
    >
      <ProgressPrimitive.Indicator
        className={cn(
          'h-full w-full flex-1 bg-primary transition-all',
          isIndeterminate && 'animate-pulse',
          indicatorClassName,
        )}
        style={isIndeterminate ? undefined : { transform: `translateX(-${100 - (value || 0)}%)` }}
      />
    </ProgressPrimitive.Root>
  );
});
Progress.displayName = ProgressPrimitive.Root.displayName;

export { Progress };
