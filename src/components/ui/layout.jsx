import * as React from 'react';
import { cn } from '../../lib/utils';

// Compatibility layout primitives (ROADMAP Phase 1B). These are thin, pure-Tailwind
// replacements for the MUI layout components used across the app — no MUI/emotion.
// They accept the small subset of MUI-ish layout props the codebase actually used
// (direction/spacing/align on Stack; container/item/xs/sm on Grid; variant/color on
// Typography) so the migration is mostly an import + className swap, not a rewrite.
// The `sx` prop is intentionally NOT supported: layout is expressed via className.

const ALIGN = {
  'flex-start': 'items-start',
  start: 'items-start',
  center: 'items-center',
  'flex-end': 'items-end',
  end: 'items-end',
  stretch: 'items-stretch',
  baseline: 'items-baseline',
};
const JUSTIFY = {
  'flex-start': 'justify-start',
  start: 'justify-start',
  center: 'justify-center',
  'flex-end': 'justify-end',
  end: 'justify-end',
  'space-between': 'justify-between',
  'space-around': 'justify-around',
  'space-evenly': 'justify-evenly',
};

// Resolve a prop that may be a plain value or a responsive object {xs, sm, md}
// into space-joined Tailwind classes via `toClass(breakpointPrefix, value)`.
function responsive(value, toClass) {
  if (value == null) return '';
  if (typeof value === 'object') {
    return Object.entries(value)
      .map(([bp, v]) => toClass(bp === 'xs' ? '' : `${bp}:`, v))
      .filter(Boolean)
      .join(' ');
  }
  return toClass('', value);
}

// ---- Box -------------------------------------------------------------------
export const Box = React.forwardRef(function Box(
  { component: Component = 'div', as, className, ...props },
  ref,
) {
  const Tag = as || Component;
  return <Tag ref={ref} className={className} {...props} />;
});

// ---- Stack -----------------------------------------------------------------
// Flexbox stack. `spacing` is in MUI units (×8px → arbitrary gap). `direction`,
// `alignItems`, `justifyContent` accept MUI values (incl. responsive direction).
export const Stack = React.forwardRef(function Stack(
  {
    component: Component = 'div',
    as,
    direction = 'column',
    spacing,
    alignItems,
    justifyContent,
    flexWrap,
    className,
    style,
    ...props
  },
  ref,
) {
  const Tag = as || Component;
  const dirClass = responsive(direction, (bp, v) => `${bp}${v === 'row' ? 'flex-row' : v === 'row-reverse' ? 'flex-row-reverse' : v === 'column-reverse' ? 'flex-col-reverse' : 'flex-col'}`);
  const gap = spacing != null ? { gap: `${spacing * 8}px` } : null;
  return (
    <Tag
      ref={ref}
      className={cn(
        'flex',
        dirClass,
        alignItems && ALIGN[alignItems],
        justifyContent && JUSTIFY[justifyContent],
        flexWrap === 'wrap' && 'flex-wrap',
        flexWrap === 'nowrap' && 'flex-nowrap',
        className,
      )}
      style={gap ? { ...gap, ...style } : style}
      {...props}
    />
  );
});

// ---- Grid ------------------------------------------------------------------
// A 12-column grid. `container` sets up the grid + gap (`spacing` ×8px); `item`
// with xs/sm/md/lg emits (responsive) col-span classes out of 12.
const SPAN = {
  1: 'col-span-1', 2: 'col-span-2', 3: 'col-span-3', 4: 'col-span-4',
  5: 'col-span-5', 6: 'col-span-6', 7: 'col-span-7', 8: 'col-span-8',
  9: 'col-span-9', 10: 'col-span-10', 11: 'col-span-11', 12: 'col-span-12',
};
const SPAN_SM = {
  1: 'sm:col-span-1', 2: 'sm:col-span-2', 3: 'sm:col-span-3', 4: 'sm:col-span-4',
  5: 'sm:col-span-5', 6: 'sm:col-span-6', 7: 'sm:col-span-7', 8: 'sm:col-span-8',
  9: 'sm:col-span-9', 10: 'sm:col-span-10', 11: 'sm:col-span-11', 12: 'sm:col-span-12',
};
const SPAN_MD = {
  1: 'md:col-span-1', 2: 'md:col-span-2', 3: 'md:col-span-3', 4: 'md:col-span-4',
  5: 'md:col-span-5', 6: 'md:col-span-6', 7: 'md:col-span-7', 8: 'md:col-span-8',
  9: 'md:col-span-9', 10: 'md:col-span-10', 11: 'md:col-span-11', 12: 'md:col-span-12',
};
export const Grid = React.forwardRef(function Grid(
  { component: Component = 'div', as, container, item, xs, sm, md, lg, spacing, className, style, ...props },
  ref,
) {
  const Tag = as || Component;
  const gap = container && spacing != null ? { gap: `${spacing * 8}px` } : null;
  return (
    <Tag
      ref={ref}
      className={cn(
        container && 'grid grid-cols-12',
        item && xs && SPAN[xs],
        item && sm && SPAN_SM[sm],
        item && (md || lg) && (SPAN_MD[md || lg]),
        className,
      )}
      style={gap ? { ...gap, ...style } : style}
      {...props}
    />
  );
});

// ---- Typography ------------------------------------------------------------
const VARIANT = {
  h1: ['h1', 'text-[2rem] font-bold tracking-tight'],
  h2: ['h2', 'text-2xl font-bold tracking-tight'],
  h3: ['h3', 'text-xl font-semibold tracking-tight'],
  h4: ['h4', 'text-lg font-semibold'],
  h5: ['h5', 'text-lg font-semibold'],
  h6: ['h6', 'text-base font-semibold'],
  subtitle1: ['p', 'text-base font-semibold'],
  subtitle2: ['p', 'text-sm font-medium'],
  body1: ['p', 'text-[0.95rem] leading-relaxed'],
  body2: ['p', 'text-sm'],
  caption: ['span', 'text-xs text-muted-foreground'],
  overline: ['span', 'text-xs uppercase tracking-wider text-muted-foreground'],
  button: ['span', 'text-sm font-semibold'],
  inherit: ['span', ''],
};
const TEXT_COLOR = {
  'text.primary': '',
  textPrimary: '',
  primary: 'text-primary',
  'primary.main': 'text-primary',
  'text.secondary': 'text-muted-foreground',
  textSecondary: 'text-muted-foreground',
  secondary: 'text-muted-foreground',
  error: 'text-destructive',
  'error.main': 'text-destructive',
  success: 'text-success',
  'success.main': 'text-success',
  warning: 'text-warning',
  'warning.main': 'text-warning',
  inherit: 'text-inherit',
};
const ALIGN_TEXT = { center: 'text-center', right: 'text-right', left: 'text-left', justify: 'text-justify' };

export const Typography = React.forwardRef(function Typography(
  { variant = 'body1', component, as, color, align, gutterBottom, noWrap, paragraph, className, ...props },
  ref,
) {
  const [defaultTag, variantClass] = VARIANT[variant] || VARIANT.body1;
  const Tag = as || component || (paragraph ? 'p' : defaultTag);
  return (
    <Tag
      ref={ref}
      className={cn(
        variantClass,
        color && TEXT_COLOR[color] !== undefined ? TEXT_COLOR[color] : '',
        align && ALIGN_TEXT[align],
        gutterBottom && 'mb-2',
        paragraph && 'mb-4',
        noWrap && 'truncate',
        className,
      )}
      {...props}
    />
  );
});

// ---- List / ListItem -------------------------------------------------------
export const List = React.forwardRef(function List({ className, dense, disablePadding, ...props }, ref) {
  return <ul ref={ref} className={cn('list-none m-0', disablePadding ? 'p-0' : 'py-2', className)} {...props} />;
});
export const ListItem = React.forwardRef(function ListItem(
  { className, disableGutters, disablePadding, secondaryAction, children, ...props },
  ref,
) {
  return (
    <li
      ref={ref}
      className={cn('flex items-center', disablePadding ? '' : disableGutters ? 'py-1.5' : 'px-2 py-1.5', className)}
      {...props}
    >
      {children}
      {secondaryAction && <span className="ml-auto flex items-center">{secondaryAction}</span>}
    </li>
  );
});
export const ListItemText = React.forwardRef(function ListItemText({ primary, secondary, className, children, ...props }, ref) {
  return (
    <div ref={ref} className={cn('min-w-0 flex-1', className)} {...props}>
      {primary != null && <div className="text-sm">{primary}</div>}
      {secondary != null && <div className="text-xs text-muted-foreground">{secondary}</div>}
      {children}
    </div>
  );
});
export const ListItemIcon = React.forwardRef(function ListItemIcon({ className, ...props }, ref) {
  return <span ref={ref} className={cn('mr-3 inline-flex min-w-[24px] items-center text-muted-foreground', className)} {...props} />;
});

// ---- Divider (alias to Separator styling for inline use) -------------------
export const Divider = React.forwardRef(function Divider({ className, orientation = 'horizontal', flexItem, ...props }, ref) {
  return (
    <div
      ref={ref}
      role="separator"
      className={cn(
        'shrink-0 bg-border',
        orientation === 'vertical' ? 'w-px self-stretch' : 'h-px w-full',
        className,
      )}
      {...props}
    />
  );
});
