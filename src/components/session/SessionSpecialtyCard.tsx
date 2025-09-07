'use client';
import { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar, Play } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { getMedicalIcon, getIconBySpecialtyName } from '@/lib/medical-icons';

export interface SessionSpecialty {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  _count?: { sessions?: number };
}

interface Props {
  specialty: SessionSpecialty;
  maxSessions: number; // for relative bar (visual parity with ExerciseCard)
}

export function SessionSpecialtyCard({ specialty, maxSessions }: Props) {
  const router = useRouter();
  const [hover, setHover] = useState(false);

  const iconData = specialty.icon ? getMedicalIcon(specialty.icon) : getIconBySpecialtyName(specialty.name);
  const IconComp = iconData.icon;
  const sessions = specialty._count?.sessions || 0;
  const percent = maxSessions > 0 ? (sessions / maxSessions) * 100 : 0;

  const iconGradient = useMemo(() => {
    let hash = 0; for (let i = 0; i < specialty.name.length; i++) hash = specialty.name.charCodeAt(i) + ((hash << 5) - hash);
    const gradients = [
      'from-blue-400 to-blue-500',
      'from-emerald-400 to-emerald-500',
      'from-medblue-400 to-medblue-500',
      'from-orange-400 to-orange-500',
      'from-rose-400 to-rose-500',
      'from-cyan-400 to-cyan-500',
      'from-lime-400 to-lime-500',
      'from-fuchsia-400 to-fuchsia-500',
      'from-indigo-400 to-indigo-500',
      'from-teal-400 to-teal-500'
    ];
    return gradients[Math.abs(hash) % gradients.length];
  }, [specialty.name]);

  const onOpen = () => {
    router.push(`/session/${specialty.id}?name=${encodeURIComponent(specialty.name)}`);
  };

  return (
    <Card
      className="relative overflow-hidden cursor-pointer transition-all duration-300 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 hover:shadow-lg hover:shadow-blue-500/25 hover:-translate-y-1"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={onOpen}
    >
      <CardContent className="p-8">
        {/* Icon */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className={`flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br ${iconGradient} border-2 border-white/20 shadow-lg mb-4 transition-transform ${hover ? 'scale-105' : ''}`}>
            <IconComp className="w-10 h-10 text-white" />
          </div>
        </div>

        {/* Title & description */}
        <div className="space-y-3 mb-6">
          <h3 className="text-lg font-bold text-left line-clamp-2 mb-2 text-gray-900 dark:text-gray-100">{specialty.name}</h3>
          {specialty.description && (
            <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-3 leading-relaxed">
              {specialty.description}
            </p>
          )}

          {/* Sessions visual (re-using progress style) */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400 flex items-center gap-1"><Calendar className="w-4 h-4" /> Sessions</span>
            <span className="font-semibold text-blue-600 dark:text-blue-400">{sessions}</span>
          </div>
          <div className="relative h-2 w-full overflow-hidden rounded-full bg-gray-200">
            <div
              className="h-full transition-all duration-300 ease-in-out rounded-full bg-blue-600"
              style={{ width: `${percent}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{sessions} session{sessions !== 1 ? 's' : ''}</span>
            <span>{percent.toFixed(0)}% of max</span>
          </div>
        </div>

        <Button
          className="w-full bg-blue-600 hover:bg-blue-700 text-white transition-colors duration-200"
          onClick={(e) => { e.stopPropagation(); onOpen(); }}
        >
          <Play className="w-4 h-4 mr-2" /> Voir sessions
        </Button>
      </CardContent>
    </Card>
  );
}
