// Icon shim (ROADMAP Phase 1B) — re-exports lucide-react icons under the MUI
// icon names the app used, so migrating an icon is just changing the import
// source. Each wrapper maps MUI's `fontSize` prop to a pixel size and strips
// MUI-only props (`color` palette strings, `sx`) that lucide doesn't understand.
import React from 'react';
import {
  Plus, ArrowLeft, BarChart3, CheckCircle2, X, Copy, Moon, Trash2, Download,
  AlertCircle, ChevronDown, ChevronRight, Info, Sun, LogOut, Cpu, Play,
  PlayCircle, RefreshCw, FlaskConical, Send, Settings, Check, Menu, Edit,
  MoreVertical, TriangleAlert, Search, Upload, Eye, EyeOff, ExternalLink,
} from 'lucide-react';
import { cn } from '../../lib/utils';

const FONT_SIZE = { small: 18, medium: 22, large: 28, inherit: '1em' };
const COLOR_CLASS = {
  primary: 'text-primary',
  secondary: 'text-muted-foreground',
  error: 'text-destructive',
  success: 'text-success',
  warning: 'text-warning',
  action: 'text-muted-foreground',
  disabled: 'text-muted-foreground opacity-50',
  inherit: 'text-inherit',
};

// Wrap a lucide icon so it accepts the MUI-style props still present in the code.
function icon(LucideIcon, displayName) {
  const Wrapped = React.forwardRef(function IconShim(
    { fontSize, size, color, sx, className, style, ...props },
    ref,
  ) {
    const px = size ?? (fontSize ? FONT_SIZE[fontSize] ?? fontSize : 20);
    const colorCls = typeof color === 'string' ? COLOR_CLASS[color] : undefined;
    return (
      <LucideIcon
        ref={ref}
        width={px}
        height={px}
        className={cn(colorCls, className)}
        style={style}
        {...props}
      />
    );
  });
  Wrapped.displayName = displayName;
  return Wrapped;
}

// MUI name -> lucide equivalent
export const Add = icon(Plus, 'Add');
export const ArrowBack = icon(ArrowLeft, 'ArrowBack');
export const BarChart = icon(BarChart3, 'BarChart');
export const CheckCircle = icon(CheckCircle2, 'CheckCircle');
export const Close = icon(X, 'Close');
export const ContentCopy = icon(Copy, 'ContentCopy');
export const DarkModeOutlined = icon(Moon, 'DarkModeOutlined');
export const Delete = icon(Trash2, 'Delete');
export const DownloadIcon = icon(Download, 'Download');
export { DownloadIcon as Download };
export const ErrorOutline = icon(AlertCircle, 'ErrorOutline');
export const ExpandMore = icon(ChevronDown, 'ExpandMore');
export const ChevronRightIcon = icon(ChevronRight, 'ChevronRight');
export { ChevronRightIcon as ChevronRight };
export const InfoIcon = icon(Info, 'Info');
export { InfoIcon as Info };
export const LightModeOutlined = icon(Sun, 'LightModeOutlined');
export const Logout = icon(LogOut, 'Logout');
export const Memory = icon(Cpu, 'Memory');
export const PlayArrow = icon(Play, 'PlayArrow');
export const PlayCircleIcon = icon(PlayCircle, 'PlayCircle');
export { PlayCircleIcon as PlayCircle };
export const Refresh = icon(RefreshCw, 'Refresh');
export const Science = icon(FlaskConical, 'Science');
export const SendIcon = icon(Send, 'Send');
export { SendIcon as Send };
export const SettingsIcon = icon(Settings, 'Settings');
export { SettingsIcon as Settings };
export const CheckIcon = icon(Check, 'Check');
export { CheckIcon as Check };
export const MenuIcon = icon(Menu, 'Menu');
export { MenuIcon as Menu };
export const EditIcon = icon(Edit, 'Edit');
export { EditIcon as Edit };
export const MoreVert = icon(MoreVertical, 'MoreVert');
export const Warning = icon(TriangleAlert, 'Warning');
export const SearchIcon = icon(Search, 'Search');
export { SearchIcon as Search };
export const UploadIcon = icon(Upload, 'Upload');
export { UploadIcon as Upload };
export const Visibility = icon(Eye, 'Visibility');
export const VisibilityOff = icon(EyeOff, 'VisibilityOff');
export const OpenInNew = icon(ExternalLink, 'OpenInNew');
