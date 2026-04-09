import React from 'react';
import { Smartphone, Monitor, RefreshCw } from 'lucide-react';
import { Button } from './ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';

export function LayoutToggle({ 
  layoutMode, 
  isAutoMode, 
  onSetMode, 
  onSetAuto, 
  onToggle,
  variant = 'default' 
}) {
  const isMobile = layoutMode === 'mobile';

  // Compact button for desktop toolbar/sidebar
  if (variant === 'compact') {
    return (
      <button
        onClick={onToggle}
        className="relative group flex items-center justify-center w-8 h-8 rounded-lg hover:bg-white/10 transition-all"
        title={isMobile ? 'Switch to Desktop Mode' : 'Switch to Mobile Mode'}
      >
        {isMobile ? (
          <Monitor className="w-4 h-4 text-white/40 group-hover:text-primary transition-colors" />
        ) : (
          <Smartphone className="w-4 h-4 text-white/40 group-hover:text-primary transition-colors" />
        )}
        <span className="absolute left-full ml-2.5 z-50 px-2.5 py-1 rounded-lg bg-black/90 backdrop-blur-sm border border-white/[0.08] text-[11px] text-white/85 font-medium whitespace-nowrap pointer-events-none opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-150 ease-out">
          {isMobile ? 'Desktop Mode' : 'Mobile Mode'}
        </span>
      </button>
    );
  }

  // Floating action button (for mobile or quick access)
  if (variant === 'floating') {
    return (
      <button
        onClick={onToggle}
        className="fixed bottom-24 right-4 z-[950] w-12 h-12 rounded-full bg-primary/90 backdrop-blur-sm border border-primary/30 shadow-lg flex items-center justify-center active:scale-95 transition-transform"
        title={isMobile ? 'Switch to Desktop' : 'Switch to Mobile'}
      >
        {isMobile ? (
          <Monitor className="w-5 h-5 text-white" />
        ) : (
          <Smartphone className="w-5 h-5 text-white" />
        )}
      </button>
    );
  }

  // Default dropdown menu
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="outline" 
          size="sm"
          className="gap-2"
        >
          {isMobile ? (
            <Smartphone className="w-4 h-4" />
          ) : (
            <Monitor className="w-4 h-4" />
          )}
          <span className="hidden sm:inline">
            {isMobile ? 'Mobile' : 'Desktop'} Mode
          </span>
          {isAutoMode && <RefreshCw className="w-3 h-3 text-muted-foreground" />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem 
          onClick={() => onSetMode('mobile')}
          className={isMobile && !isAutoMode ? 'bg-primary/10' : ''}
        >
          <Smartphone className="w-4 h-4 mr-2" />
          Mobile Mode
          {!isAutoMode && isMobile && <span className="ml-auto text-xs text-primary">Active</span>}
        </DropdownMenuItem>
        <DropdownMenuItem 
          onClick={() => onSetMode('desktop')}
          className={!isMobile && !isAutoMode ? 'bg-primary/10' : ''}
        >
          <Monitor className="w-4 h-4 mr-2" />
          Desktop Mode
          {!isAutoMode && !isMobile && <span className="ml-auto text-xs text-primary">Active</span>}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem 
          onClick={onSetAuto}
          className={isAutoMode ? 'bg-primary/10' : ''}
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Auto Detect
          {isAutoMode && <span className="ml-auto text-xs text-primary">Active</span>}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function LayoutModeIndicator({ layoutMode, onClick }) {
  const isMobile = layoutMode === 'mobile';
  
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors text-xs text-white/60"
    >
      {isMobile ? (
        <>
          <Smartphone className="w-3.5 h-3.5" />
          <span>Mobile</span>
        </>
      ) : (
        <>
          <Monitor className="w-3.5 h-3.5" />
          <span>Desktop</span>
        </>
      )}
    </button>
  );
}

export default LayoutToggle;
