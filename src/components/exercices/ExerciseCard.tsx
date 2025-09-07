'use client';
import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Edit2, Trash2, Play, Lock, Pin, PinOff } from 'lucide-react';
import { Specialty } from '@/types';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'next/navigation';
import { getMedicalIcon, getIconBySpecialtyName } from '@/lib/medical-icons';
import { useSubscription } from '@/contexts/SubscriptionContext';

interface ExerciseCardProps {
  specialty: Specialty;
  onEdit?: (specialty: Specialty) => void;
  onDelete?: (specialty: Specialty) => void;
  isPinned?: boolean;
  onPin?: (specialty: Specialty) => void;
  onUnpin?: (specialty: Specialty) => void;
}

export function ExerciseCard({ specialty, onEdit, onDelete, isPinned = false, onPin, onUnpin }: ExerciseCardProps) {
  const { isAdmin } = useAuth();
  const { hasActiveSubscription } = useSubscription();
  const { t } = useTranslation();
  const router = useRouter();
  const [isHovered, setIsHovered] = useState(false);

  // Get medical icon for the specialty - use database icon if available, otherwise fall back to name-based lookup
  const medicalIcon = specialty.icon ? getMedicalIcon(specialty.icon) : getIconBySpecialtyName(specialty.name);
  const IconComponent = medicalIcon.icon;

  // Calculate progress
  const progress = specialty.progress?.questionProgress || 0;
  const totalQuestions = specialty.progress?.totalQuestions || specialty._count?.questions || 0;
  const completedQuestions = specialty.progress?.completedQuestions || Math.round((progress / 100) * totalQuestions);

  // Check if specialty is accessible (free or user has subscription)
  const canAccess = specialty.isFree || hasActiveSubscription || isAdmin;

  // Get icon color - use custom color if set, otherwise generate from name
  const getIconColor = (name: string) => {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    const colors = [
      'from-blue-400 to-blue-500',
      'from-emerald-400 to-emerald-500',
      'from-medblue-400 to-medblue-500',
      'from-orange-400 to-orange-500',
      'from-rose-400 to-rose-500',
      'from-cyan-400 to-cyan-500',
      'from-lime-400 to-lime-500',
      'from-fuchsia-400 to-fuchsia-500',
      'from-indigo-400 to-indigo-500',
      'from-teal-400 to-teal-500',
    ];
    
    return colors[Math.abs(hash) % colors.length];
  };

  // Use custom icon color if available, otherwise generate from name
  const iconColor = getIconColor(specialty.name);
  const customIconColor = (specialty as any)?.iconColor;

  const renderIcon = () => {
    const iconType = (specialty as any)?.iconType || 'icon';
    
    if (iconType === 'image' && (specialty as any)?.imageUrl) {
      // Render custom image
      return (
        <div className={`flex items-center justify-center w-20 h-20 rounded-full border-2 overflow-hidden ${
          canAccess 
            ? 'border-white/20 shadow-lg' 
            : 'border-gray-200 dark:border-gray-600'
        } mb-4`}>
          <img 
            src={(specialty as any).imageUrl} 
            alt={specialty.name}
            className="w-full h-full object-cover"
          />
        </div>
      );
    } else {
      // Render icon with custom or generated color
      const displayColor = customIconColor;
      const isHexColor = customIconColor && customIconColor.startsWith('#');
      
      if (isHexColor && canAccess) {
        // Use solid hex color as background
        return (
          <div 
            className={`flex items-center justify-center w-20 h-20 rounded-full border-2 ${
              canAccess 
                ? 'border-white/20 shadow-lg' 
                : 'border-gray-200 dark:border-gray-600'
            } mb-4`}
            style={{ backgroundColor: canAccess ? displayColor : '#9CA3AF' }}
          >
            <IconComponent className="w-10 h-10 text-white" />
          </div>
        );
      } else {
        // Use gradient color
        return (
          <div className={`flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br border-2 ${
            canAccess 
              ? `${iconColor} border-white/20 shadow-lg` 
              : 'from-gray-400 to-gray-500 border-gray-200 dark:border-gray-600'
          } mb-4`}>
            <IconComponent className={`w-10 h-10 ${canAccess ? (displayColor || 'text-white') : 'text-white'}`} />
          </div>
        );
      }
    }
  };

  const handleCardClick = () => {
    if (canAccess) {
      router.push(`/matieres/${specialty.id}`);
    }
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEdit?.(specialty);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete?.(specialty);
  };

  return (
    <Card 
      className={`relative overflow-hidden cursor-pointer transition-all duration-300 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 ${
        canAccess 
          ? 'hover:shadow-lg hover:shadow-blue-500/25 hover:-translate-y-1' 
          : 'opacity-75 cursor-not-allowed'
      }`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleCardClick}
    >
      <CardContent className="p-8">
        {/* Pin Button - Top Left (All Users) */}
        {isHovered && (onPin || onUnpin) && (
          <div className="absolute top-4 left-4 z-10">
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                if (isPinned && onUnpin) {
                  onUnpin(specialty);
                } else if (!isPinned && onPin) {
                  onPin(specialty);
                }
              }}
              className={`h-8 w-8 p-0 transition-all duration-200 ${
                isPinned 
                  ? 'hover:bg-yellow-50 dark:hover:bg-yellow-900/20 text-yellow-600' 
                  : 'hover:bg-gray-50 dark:hover:bg-gray-900/20 text-gray-600'
              }`}
              title={isPinned ? 'Unpin specialty' : 'Pin specialty'}
            >
              {isPinned ? (
                <PinOff className="h-3 w-3" />
              ) : (
                <Pin className="h-3 w-3" />
              )}
            </Button>
          </div>
        )}

        {/* Pinned Indicator - Always Visible When Pinned */}
        {isPinned && !isHovered && (
          <div className="absolute top-3 left-3 z-10">
            <div className="bg-yellow-100 dark:bg-yellow-900/30 rounded-full p-1.5 shadow-sm">
              <Pin className="h-3 w-3 text-yellow-600 dark:text-yellow-400" />
            </div>
          </div>
        )}

        {/* Admin Actions - Top Right */}
        {isAdmin && isHovered && (
          <div className="absolute top-4 right-4 flex gap-1 z-10">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleEdit}
              className="h-8 w-8 p-0 hover:bg-blue-50 dark:hover:bg-blue-900/20"
            >
              <Edit2 className="h-3 w-3 text-blue-600" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDelete}
              className="h-8 w-8 p-0 hover:bg-red-50 dark:hover:bg-red-900/20"
            >
              <Trash2 className="h-3 w-3 text-red-600" />
            </Button>
          </div>
        )}

        {/* Centered Icon */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="relative">
            {/* Medical Icon or Custom Image */}
            {renderIcon()}
            
            {/* Lock Icon for Premium Content */}
            {!canAccess && (
              <div className="absolute -top-1 -right-1 flex items-center justify-center w-7 h-7 bg-amber-100 dark:bg-amber-900/50 rounded-full border-2 border-amber-200 dark:border-amber-700">
                <Lock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              </div>
            )}
          </div>
        </div>

        {/* Progress Section with Title Above */}
        <div className="space-y-3 mb-6">
          {/* Specialty Name - Left Aligned Above Progress */}
          <h3 className={`text-lg font-bold text-left line-clamp-2 mb-3 ${
            canAccess ? 'text-gray-900 dark:text-gray-100' : 'text-gray-500 dark:text-gray-400'
          }`}>
            {specialty.name}
          </h3>
          
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">Global Progress</span>
            <span className={`font-semibold ${canAccess ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500'}`}>
              {Math.round(progress)}%
            </span>
          </div>
          
          <div className="relative h-2 w-full overflow-hidden rounded-full bg-gray-200">
            <div 
              className={`h-full transition-all duration-300 ease-in-out rounded-full ${
                canAccess ? 'bg-blue-600' : 'bg-gray-400'
              }`}
              style={{ width: `${progress}%` }}
            />
          </div>
          
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{completedQuestions} / {totalQuestions} questions</span>
            <span>{specialty._count?.lectures || 0} courses</span>
          </div>
        </div>

        {/* Start Learning Button */}
        <Button 
          className={`w-full ${
            canAccess 
              ? 'bg-blue-600 hover:bg-blue-700 text-white' 
              : 'bg-gray-300 hover:bg-gray-400 text-gray-600 cursor-not-allowed'
          } transition-colors duration-200`}
          onClick={(e) => {
            e.stopPropagation();
            handleCardClick();
          }}
          disabled={!canAccess}
        >
          <Play className="w-4 h-4 mr-2" />
          {progress > 0 ? 'Continue' : 'Start Learning'}
        </Button>
      </CardContent>
    </Card>
  );
}
