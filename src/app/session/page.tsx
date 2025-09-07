"use client";

import { useEffect, useState, useMemo } from 'react';
import { FileText } from 'lucide-react';
import { UniversalHeader } from '@/components/layout/UniversalHeader';
import { AppSidebar, AppSidebarProvider } from '@/components/layout/AppSidebar';
import { SidebarInset } from '@/components/ui/sidebar';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';

type Specialty = {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  semester?: { id: string; name: string; order: number };
  _count?: { sessions: number };
};

import { SessionSpecialtyCard } from '@/components/session/SessionSpecialtyCard';

export default function SessionsPage() {
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  useEffect(() => {
    const loadSpecialties = async () => {
      try {
        const response = await fetch('/api/specialties/with-sessions');
        if (response.ok) {
          const data = await response.json();
          setSpecialties(data);
        }
      } catch (error) {
        console.error('Failed to load specialties:', error);
      } finally {
        setLoading(false);
      }
    };

    loadSpecialties();
  }, []);

  const filtered = useMemo(() => {
    if (!query.trim()) return specialties;
    const q = query.toLowerCase();
    return specialties.filter(s =>
      s.name.toLowerCase().includes(q) ||
      (s.description?.toLowerCase().includes(q))
    );
  }, [query, specialties]);

  return (
    <ProtectedRoute>
      <AppSidebarProvider>
        <div className="flex min-h-screen w-full">
          <AppSidebar />
          <SidebarInset className="flex-1 flex flex-col">
            <UniversalHeader
              title="Sessions d'examens"
              showSearch
              searchValue={query}
              onSearchChange={setQuery}
              searchPlaceholder="Chercher une spécialité..."
              hideSeparator
            />
            <div className="flex-1 bg-gray-50 dark:bg-gray-900">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
                {loading ? (
                  <div className="flex items-center justify-center min-h-[40vh]">
                    <div className="flex items-center gap-3 bg-white/80 dark:bg-slate-800/80 px-6 py-4 rounded-xl shadow-lg backdrop-blur-sm">
                      <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-600 border-t-transparent" />
                      <span className="text-blue-800 dark:text-blue-200 font-medium">Chargement des spécialités...</span>
                    </div>
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="border-border/50 bg-white/50 dark:bg-muted/30 backdrop-blur-sm shadow-lg rounded-xl p-8">
                    <div className="flex flex-col items-center justify-center py-12">
                      <div className="w-16 h-16 rounded-xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center mb-4">
                        <FileText className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                      </div>
                      <h3 className="text-lg font-semibold mb-2 text-blue-800 dark:text-blue-200">Aucune spécialité</h3>
                      <p className="text-blue-600 dark:text-blue-400 text-center">
                        {query ? 'Aucun résultat pour cette recherche.' : "Aucune session d'examen disponible."}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                    {(() => {
                      const maxSessions = filtered.reduce((m, s) => Math.max(m, s._count?.sessions || 0), 0);
                      return filtered.map(s => (
                        <SessionSpecialtyCard key={s.id} specialty={s} maxSessions={maxSessions} />
                      ));
                    })()}
                  </div>
                )}
              </div>
            </div>
          </SidebarInset>
        </div>
      </AppSidebarProvider>
    </ProtectedRoute>
  );
}
