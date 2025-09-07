'use client';
import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { 
  Bell, 
  Search, 
  User, 
  Settings, 
  LogOut,
  UserCircle,
  Menu,
  X
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from '@/hooks/use-toast';
import { useSidebar } from '@/components/ui/sidebar';

interface UniversalHeaderProps {
  title?: string;
  actions?: React.ReactNode;
  leftActions?: React.ReactNode; // New prop for left-side actions like return button
  hideSeparator?: boolean;
  // Optional search props (used on exercises page). Completely optional so other pages remain unaffected.
  showSearch?: boolean;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
}

export function UniversalHeader({
  title,
  actions,
  leftActions,
  hideSeparator = false,
  showSearch = false,
  searchValue = '',
  onSearchChange,
  searchPlaceholder = 'Search...'
}: UniversalHeaderProps) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const { t } = useTranslation();
  const [notificationCount] = useState(3); // Mock notification count
  const { toggleSidebar, open, openMobile, isMobile } = useSidebar();

  const handleSignOut = async () => {
    try {
      await logout();
      router.push('/auth');
    } catch (err) {
      console.error('Unexpected sign out error:', err);
      toast({
        title: t('auth.signOutError'),
        description: t('auth.unexpectedError'),
        variant: "destructive",
      });
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    // Rolled back to earlier gray background scheme
    <div className="bg-gray-50 dark:bg-gray-900 sticky top-0 z-40 pt-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Left Section: Mobile Menu Button, Title and Search */}
          <div className="flex items-center space-x-4 flex-1">
            {/* Mobile Sidebar Toggle Button - Only visible on mobile */}
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleSidebar}
              className="lg:hidden shrink-0"
              aria-label="Toggle sidebar"
            >
              <Menu className="h-5 w-5" />
            </Button>

            {/* Title Section */}
            {(title || showSearch) && (
              <div className="min-w-0 flex-1 flex items-center gap-4">
                {title && (
                  <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100 truncate">
                    {title}
                  </h1>
                )}
                {showSearch && (
                  <div className="hidden md:block w-full max-w-xs">
                    <Input
                      value={searchValue}
                      onChange={(e) => onSearchChange?.(e.target.value)}
                      placeholder={searchPlaceholder}
                      className="h-9"
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right Section: Notifications, Profile */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            {/* Notifications */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative shrink-0">
                  <Bell className="h-4 w-4 sm:h-5 sm:w-5" />
                  {notificationCount > 0 && (
                    <Badge 
                      variant="destructive" 
                      className="absolute -top-1 -right-1 h-4 w-4 sm:h-5 sm:w-5 flex items-center justify-center p-0 text-xs"
                    >
                      {notificationCount}
                    </Badge>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72 sm:w-80">
                <DropdownMenuLabel>Notifications</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium">New question added</p>
                    <p className="text-xs text-muted-foreground">Cardiology - 2 minutes ago</p>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium">Progress updated</p>
                    <p className="text-xs text-muted-foreground">General Surgery - 1 hour ago</p>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium">New lecture available</p>
                    <p className="text-xs text-muted-foreground">Endocrinology - 3 hours ago</p>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-center">
                  <span className="text-primary hover:text-primary/80">View all notifications</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Profile Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-8 w-8 sm:h-9 sm:w-9 rounded-full shrink-0">
                  <Avatar className="h-8 w-8 sm:h-9 sm:w-9">
                    <AvatarImage src={user?.image} alt={user?.name || user?.email || 'User'} />
                    <AvatarFallback className="bg-primary text-primary-foreground text-xs sm:text-sm">
                      {user?.name ? getInitials(user.name) : <UserCircle className="h-4 w-4 sm:h-5 sm:w-5" />}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{user?.name || 'User'}</p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {user?.email}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => router.push('/profile')}>
                  <User className="mr-2 h-4 w-4" />
                  <span>Profile</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push('/settings')}>
                  <Settings className="mr-2 h-4 w-4" />
                  <span>Settings</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut}>
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
      
      {/* Actions Row - Below Header */}
      {(actions || leftActions) && (
        <div className={`bg-gray-50 dark:bg-gray-900 ${hideSeparator ? '' : 'border-t border-gray-200 dark:border-gray-700'}`}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-3">
              {/* Left actions - typically return/back buttons */}
              {leftActions && (
                <div className="flex items-center gap-2">
                  {leftActions}
                </div>
              )}
              {/* Right actions - typically other action buttons */}
              {actions && (
                <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 ml-auto">
                  {actions}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* Mobile search (only when enabled) */}
      {showSearch && (
        <div className="px-4 pb-4 md:hidden">
          <Input
            value={searchValue}
            onChange={(e) => onSearchChange?.(e.target.value)}
            placeholder={searchPlaceholder}
            className="h-10"
          />
        </div>
      )}
    </div>
  );
}
