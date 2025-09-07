"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import { Kalam } from 'next/font/google';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { StickyNote, CheckCircle2, Loader2, Trash2, Edit3, X } from 'lucide-react';
import { RichTextInput, ImageData } from '@/components/ui/rich-text-input';
import { RichTextDisplay } from '@/components/ui/rich-text-display';

interface QuestionNotesProps {
  questionId: string;
  onHasContentChange?: (hasContent: boolean) => void;
  autoEdit?: boolean; // Auto-enter edit mode when opened
  // Note: close handling removed – parent now solely controls visibility
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error' | 'loading';

// Handwritten style font (must be at module scope for next/font)
const handwritten = Kalam({ subsets: ['latin'], weight: ['400', '700'], display: 'swap' });

export function QuestionNotes({ questionId, onHasContentChange, autoEdit = false }: QuestionNotesProps) {
  const { user } = useAuth();
  const [value, setValue] = useState('');
  const [images, setImages] = useState<ImageData[]>([]);
  const [initialLoaded, setInitialLoaded] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const lastSavedValueRef = useRef('');
  const lastSavedImagesRef = useRef<ImageData[]>([]);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const syncDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // Generate localStorage key for this question and user
  const localStorageKey = useMemo(() => {
    return `notes_${user?.id || 'guest'}_${questionId}`;
  }, [user?.id, questionId]);

  // Check if there's any content (text or images)
  const hasContent = useMemo(() => {
    return Boolean((value && value.trim()) || images.length > 0);
  }, [value, images]);

  // Notify parent when content state changes
  useEffect(() => {
    onHasContentChange?.(hasContent);
  }, [hasContent, onHasContentChange]);

  // Auto-enter edit mode when autoEdit is true and no content exists
  useEffect(() => {
    if (autoEdit && !hasContent && initialLoaded) {
      setIsEditing(true);
    }
  }, [autoEdit, hasContent, initialLoaded]);

  // Helper function to extract image IDs from content
  const extractImageIds = (content: string): string[] => {
    const imageIds: string[] = [];
    const imageRegex = /\[IMAGE:([^\]]+)\]/g;
    let match;
    while ((match = imageRegex.exec(content)) !== null) {
      imageIds.push(match[1]);
    }
    return imageIds;
  };

  // Helper function to clean content of orphaned image references
  const cleanOrphanedImages = (content: string, availableImageUrls: string[]): string => {
    if (!availableImageUrls.length) {
      // Remove all image references if no URLs available
      return content.replace(/\[IMAGE:[^\]]+\]/g, '');
    }
    
    // Extract image IDs from content
    const contentImageIds = extractImageIds(content);
    
    // Remove image references that don't have corresponding URLs
    let cleanedContent = content;
    contentImageIds.forEach((imageId, index) => {
      if (index >= availableImageUrls.length) {
        // Remove this image reference as there's no corresponding URL
        cleanedContent = cleanedContent.replace(new RegExp(`\\[IMAGE:${imageId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\]`, 'g'), '');
      }
    });
    
    return cleanedContent.trim();
  };

  // Check if there are unsaved changes
  const hasChanges = useMemo(() => {
    return value !== lastSavedValueRef.current || 
           JSON.stringify(images) !== JSON.stringify(lastSavedImagesRef.current);
  }, [value, images]);

  // Load from localStorage first, then sync with server
  useEffect(() => {
    let cancelled = false;
    
    // Reset state when questionId changes
    setValue('');
    setImages([]);
    setInitialLoaded(false);
    setSaveState('idle');
    setIsEditing(false);
    lastSavedValueRef.current = '';
    lastSavedImagesRef.current = [];

    const loadFromLocalStorage = () => {
      try {
        const saved = localStorage.getItem(localStorageKey);
        if (saved) {
          const data = JSON.parse(saved);
          if (data.value || data.images?.length > 0) {
            setValue(data.value || '');
            setImages(data.images || []);
            lastSavedValueRef.current = data.value || '';
            lastSavedImagesRef.current = data.images || [];
            setLastSavedAt(data.lastSavedAt ? new Date(data.lastSavedAt) : null);
          }
        }
      } catch (error) {
        console.error('Error loading from localStorage:', error);
      }
    };

    async function syncWithServer() {
      if (!user?.id || cancelled) return;
      try {
        setSaveState('loading');
        const res = await fetch(`/api/user-question-state?userId=${user.id}&questionId=${questionId}`);
        if (!res.ok || cancelled) return;
        const data = await res.json();
        
        if (!cancelled) {
          let serverNotes = '';
          let serverImageUrls: string[] = [];
          
          if (typeof data?.notes === 'string') {
            serverNotes = data.notes;
          }
          
          if (Array.isArray(data?.notesImageUrls)) {
            serverImageUrls = data.notesImageUrls as string[];
          }

          // Check if we should use server data (if it's different from localStorage)
          const localData = localStorage.getItem(localStorageKey);
          let shouldUseServerData = true;
          
          if (localData) {
            try {
              const parsed = JSON.parse(localData);
              // If localStorage has data and server data is the same, don't override
              if (parsed.value === serverNotes && JSON.stringify(parsed.images?.map((img: any) => img.url) || []) === JSON.stringify(serverImageUrls)) {
                shouldUseServerData = false;
              }
            } catch (e) {
              // If parsing fails, use server data
            }
          }

          if (shouldUseServerData && (serverNotes || serverImageUrls.length > 0)) {
            // Clean orphaned image references from content
            const cleanedNotes = cleanOrphanedImages(serverNotes, serverImageUrls);
            
            // Create ImageData objects that match the actual image IDs in the content
            const contentImageIds = extractImageIds(cleanedNotes);
            const imageData = contentImageIds.map((imageId, index) => ({
              id: imageId,
              url: serverImageUrls[index] || '', // Use actual URL or empty if not available
              description: ''
            })).filter(img => img.url); // Only keep images that have valid URLs
            
            setValue(cleanedNotes);
            setImages(imageData);
            lastSavedValueRef.current = cleanedNotes;
            lastSavedImagesRef.current = imageData;
            
            const now = new Date();
            setLastSavedAt(now);

            // Save to localStorage
            localStorage.setItem(localStorageKey, JSON.stringify({
              value: cleanedNotes,
              images: imageData,
              lastSavedAt: now.toISOString()
            }));
          }
        }
      } catch (error) {
        console.error('Error syncing with server:', error);
      } finally {
        if (!cancelled) {
          setSaveState('idle');
          setInitialLoaded(true);
        }
      }
    }

    // Load from localStorage immediately for fast UI
    loadFromLocalStorage();
    
    // Then sync with server in background
    syncWithServer();

    return () => { 
      cancelled = true; 
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (syncDebounceRef.current) clearTimeout(syncDebounceRef.current);
    };
  }, [questionId, user?.id, localStorageKey]);

  const saveToLocalStorage = (content: string, imageData: ImageData[]) => {
    try {
      const now = new Date();
      localStorage.setItem(localStorageKey, JSON.stringify({
        value: content,
        images: imageData,
        lastSavedAt: now.toISOString()
      }));
      setLastSavedAt(now);
      return true;
    } catch (error) {
      console.error('Error saving to localStorage:', error);
      return false;
    }
  };

  const syncToServer = async (content: string, imageUrls: string[], silent = true) => {
    if (!user?.id) return false;
    
    try {
      const res = await fetch('/api/user-question-state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userId: user.id, 
          questionId, 
          notes: content, 
          notesImageUrls: imageUrls 
        }),
      });
      
      if (res.ok) {
        if (!silent) toast({ title: 'Synchronisé', description: 'Votre note a été synchronisée avec le serveur.' });
        return true;
      }
      throw new Error('Server sync failed');
    } catch (error) {
      console.error('Error syncing to server:', error);
      if (!silent) toast({ title: 'Erreur de synchronisation', description: 'La note est sauvée localement mais pas sur le serveur', variant: 'destructive' });
      return false;
    }
  };

  const save = async (silent = false) => {
    if (!user?.id) {
      if (!silent) toast({ title: 'Connexion requise', description: 'Veuillez vous connecter pour sauvegarder les notes', variant: 'destructive' });
      return;
    }
    
    try {
      setSaveState('saving');
      
      // Clean the content before saving
      const imageUrls = images.map(img => img.url);
      const cleanedContent = cleanOrphanedImages(value, imageUrls);
      
      // Save to localStorage immediately (fast)
      const localSaved = saveToLocalStorage(cleanedContent, images);
      
      if (localSaved) {
        // Update local state
        setValue(cleanedContent);
        lastSavedValueRef.current = cleanedContent;
        lastSavedImagesRef.current = [...images];
        setSaveState('saved');
        if (!silent) toast({ title: 'Sauvegardé', description: 'Votre note a été sauvegardée.' });
        
        // Sync to server in background with debounce
        if (syncDebounceRef.current) clearTimeout(syncDebounceRef.current);
        syncDebounceRef.current = setTimeout(() => {
          syncToServer(cleanedContent, imageUrls, true);
        }, 2000); // 2 second delay for server sync
        
        // revert to idle after a moment
        setTimeout(() => setSaveState('idle'), 1200);
      } else {
        throw new Error('LocalStorage save failed');
      }
    } catch (error) {
      setSaveState('error');
      if (!silent) toast({ title: 'Erreur', description: 'Échec de la sauvegarde de la note', variant: 'destructive' });
    }
  };

  // Autosave on change (debounced) - fast localStorage save
  useEffect(() => {
    if (!initialLoaded) return;
    if (!hasChanges) return;
    if (!user?.id) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { void save(true); }, 500); // Faster autosave since we use localStorage
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [value, images, initialLoaded, hasChanges, user?.id]);

  const clearNote = async () => {
    setValue('');
    setImages([]);
    setIsEditing(false);
    
    // Clear localStorage immediately
    try {
      localStorage.removeItem(localStorageKey);
    } catch (error) {
      console.error('Error clearing localStorage:', error);
    }
    
    // Clear on server in background
    if (user?.id) {
      syncToServer('', [], true);
    }
    
    lastSavedValueRef.current = '';
    lastSavedImagesRef.current = [];
    setLastSavedAt(null);
    toast({ title: 'Effacé', description: 'Votre note a été effacée.' });
  };

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    // Restore last saved values
    setValue(lastSavedValueRef.current);
    setImages([...lastSavedImagesRef.current]);
    setIsEditing(false);
  };

  const handleSaveEdit = async () => {
    await save(false);
    setIsEditing(false);
  };

  const status = (
    <div className="flex items-center gap-2 text-xs">
      {saveState === 'loading' && (
  <span className="flex items-center gap-2 text-blue-700 dark:text-blue-300 bg-blue-50/90 dark:bg-blue-500/15 px-3 py-1.5 rounded-full border border-blue-300/60 dark:border-blue-400/40 shadow-sm">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> 
          Chargement…
        </span>
      )}
      {saveState === 'saving' && (
  <span className="flex items-center gap-2 text-blue-700 dark:text-blue-300 bg-blue-50/90 dark:bg-blue-500/15 px-3 py-1.5 rounded-full border border-blue-300/60 dark:border-blue-400/40 shadow-sm">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> 
          Sauvegarde…
        </span>
      )}
      {saveState === 'saved' && (
  <span className="flex items-center gap-2 text-green-700 dark:text-green-300 bg-green-50/90 dark:bg-green-500/15 px-3 py-1.5 rounded-full border border-green-300/60 dark:border-green-400/40 shadow-sm">
          <CheckCircle2 className="h-3.5 w-3.5" /> 
          Sauvegardé
        </span>
      )}
      {saveState === 'error' && (
  <span className="text-red-600 dark:text-red-300 font-medium bg-red-50/90 dark:bg-red-500/15 px-3 py-1.5 rounded-full border border-red-300/70 dark:border-red-400/50 shadow-sm">
          Échec de la sauvegarde
        </span>
      )}
      {saveState === 'idle' && lastSavedAt && !hasChanges && (
  <span className="text-gray-600 dark:text-slate-200 bg-white/70 dark:bg-slate-800/70 px-3 py-1.5 rounded-full border border-gray-300/70 dark:border-slate-600/60 shadow-sm font-medium tracking-tight">
          Sauvegardé à {lastSavedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      )}
    </div>
  );

  // If no content and not editing, show the input mode
  if (!hasContent && !isEditing) {
    return (
      <div className="mt-6">
        <div className="rounded-3xl overflow-hidden shadow-xl hover:shadow-2xl transition-all duration-500 border border-gray-200/50 dark:border-gray-700/50 transform hover:scale-[1.01] hover:rotate-[0.3deg]">
          {/* iOS Notes style header with improved gradient & title */}
          <div className="h-14 bg-gradient-to-b from-yellow-200 via-yellow-300 to-yellow-400 dark:from-yellow-300 dark:via-yellow-400 dark:to-yellow-500 border-b border-yellow-400/40 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent dark:via-transparent animate-pulse"></div>
            <div className="absolute inset-0 opacity-[0.1] dark:opacity-[0.08] bg-[radial-gradient(circle_at_2px_2px,_rgba(0,0,0,0.25)_1px,_transparent_0)] bg-[length:12px_12px]"></div>
            <div className="relative z-10 h-full flex items-center justify-between px-6">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-full bg-gradient-to-br from-yellow-200 via-yellow-300 to-yellow-400 text-yellow-800 dark:text-yellow-900 grid place-items-center shadow-lg ring-2 ring-yellow-300/30">
                  <StickyNote className="h-4.5 w-4.5" />
                </div>
                <span className="text-lg font-semibold text-gray-800 dark:text-gray-900/90 tracking-tight drop-shadow-sm">Mes Notes</span>
              </div>
              <div className="flex items-center gap-3">
                {status}
              </div>
            </div>
          </div>
          
          {/* Enhanced dotted line separator */}
          <div className="h-0.5 bg-gradient-to-r from-transparent via-red-400 to-transparent dark:via-red-500 shadow-sm"></div>
          
          {/* Content area with lines */}
          <div className="bg-white dark:bg-gray-900 relative min-h-[180px]" style={{
            backgroundImage: `
              repeating-linear-gradient(
                transparent,
                transparent 31px,
                rgb(59 130 246 / 0.12) 31px,
                rgb(59 130 246 / 0.12) 32px
              )
            `,
          }}>
            {/* Enhanced red margin line with gradient */}
            <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gradient-to-b from-red-300 via-red-400 to-red-300 dark:from-red-400 dark:via-red-500 dark:to-red-400 opacity-70 shadow-sm"></div>
            
            {/* Enhanced paper texture */}
            <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.06] pointer-events-none bg-[radial-gradient(circle_at_1.5px_1.5px,_rgba(0,0,0,0.15)_1px,_transparent_0)] bg-[length:10px_10px]"></div>
            
            {/* Subtle vignette effect */}
            <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-black/[0.02] dark:to-white/[0.01] pointer-events-none"></div>
            
            <div className="pl-12 pr-6 pt-[13px] pb-6 relative z-10">
              <RichTextInput
                value={value}
                onChange={setValue}
                images={images}
                onImagesChange={setImages}
                placeholder="Tapez votre note ici…\nAjoutez des images avec la barre d'outils."
                className={`min-h-[170px] bg-transparent border-none focus-within:ring-0 focus-within:border-none text-gray-800 dark:text-gray-200 placeholder:text-gray-400/80 dark:placeholder:text-gray-500/70 ${handwritten.className} text-[18px] leading-[32px] tracking-[0.25px] selection:bg-yellow-200/60 dark:selection:bg-yellow-300/40 [&_p]:m-0 [&_div]:leading-[32px] [&_*]:leading-[32px]`}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // If there's content, show the card mode
  return (
    <div className="mt-6">
      <div className="rounded-3xl overflow-hidden shadow-xl hover:shadow-2xl transition-all duration-500 border border-gray-200/50 dark:border-gray-700/50 transform hover:scale-[1.01] hover:rotate-[0.3deg]">
        {/* iOS Notes style header with improved gradient & title */}
        <div className="h-14 bg-gradient-to-b from-yellow-200 via-yellow-300 to-yellow-400 dark:from-yellow-300 dark:via-yellow-400 dark:to-yellow-500 border-b border-yellow-400/40 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent dark:via-transparent"></div>
          <div className="absolute inset-0 opacity-[0.1] dark:opacity-[0.08] bg-[radial-gradient(circle_at_2px_2px,_rgba(0,0,0,0.25)_1px,_transparent_0)] bg-[length:12px_12px]"></div>
          <div className="relative z-10 h-full flex items-center justify-between px-6">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-gradient-to-br from-yellow-200 via-yellow-300 to-yellow-400 text-yellow-800 dark:text-yellow-900 grid place-items-center shadow-lg ring-2 ring-yellow-300/30">
                <StickyNote className="h-4.5 w-4.5" />
              </div>
              <span className="text-lg font-semibold text-gray-800 dark:text-gray-900/90 tracking-tight drop-shadow-sm">Mes Notes</span>
            </div>
            <div className="flex items-center gap-3">
              {status}
              {!isEditing && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleEdit}
                  className="h-8 px-3 text-gray-700 dark:text-gray-800 hover:bg-yellow-200/60 dark:hover:bg-yellow-400/40 hover:text-gray-800 dark:hover:text-gray-900 border border-transparent hover:border-yellow-300/60 dark:hover:border-yellow-500/60 transition-all duration-300 rounded-lg shadow-sm hover:shadow-md backdrop-blur-sm font-medium"
                >
                  <Edit3 className="h-3.5 w-3.5 mr-1.5" />
                  Modifier
                </Button>
              )}
              {isEditing && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCancelEdit}
                    className="h-8 px-3 text-gray-700 dark:text-gray-800 hover:bg-yellow-200/60 dark:hover:bg-yellow-400/40 hover:text-gray-800 dark:hover:text-gray-900 border border-transparent hover:border-yellow-300/60 dark:hover:border-yellow-500/60 transition-all duration-300 rounded-lg shadow-sm hover:shadow-md backdrop-blur-sm font-medium"
                  >
                    <X className="h-3.5 w-3.5 mr-1.5" />
                    Annuler
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSaveEdit}
                    disabled={!initialLoaded || !hasChanges}
                    className="h-8 px-3 bg-gradient-to-r from-blue-500 via-blue-600 to-blue-700 dark:from-blue-500 dark:via-blue-600 dark:to-blue-700 hover:from-blue-600 hover:via-blue-700 hover:to-blue-800 dark:hover:from-blue-400 dark:hover:via-blue-500 dark:hover:to-blue-600 text-white dark:text-white border-0 shadow-lg hover:shadow-xl dark:shadow-blue-500/25 dark:hover:shadow-blue-400/30 transition-all duration-300 rounded-lg font-medium tracking-wide disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Sauvegarder
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Enhanced dotted line separator */}
        <div className="h-0.5 bg-gradient-to-r from-transparent via-red-400 to-transparent dark:via-red-500 shadow-sm"></div>
        
        {/* Content area with enhanced lines */}
        <div className="bg-white dark:bg-gray-900 relative min-h-[220px]" style={{
          backgroundImage: `
            repeating-linear-gradient(
              transparent,
              transparent 31px,
              rgb(59 130 246 / 0.12) 31px,
              rgb(59 130 246 / 0.12) 32px
            )
          `,
        }}>
          {/* Enhanced red margin line with gradient */}
          <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gradient-to-b from-red-300 via-red-400 to-red-300 dark:from-red-400 dark:via-red-500 dark:to-red-400 opacity-70 shadow-sm"></div>
          
          {/* Enhanced paper texture */}
          <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.06] pointer-events-none bg-[radial-gradient(circle_at_1.5px_1.5px,_rgba(0,0,0,0.15)_1px,_transparent_0)] bg-[length:10px_10px]"></div>
          
          {/* Subtle vignette effect */}
          <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-black/[0.02] dark:to-white/[0.01] pointer-events-none"></div>
          
          <div className="pl-12 pr-6 pt-[13px] pb-6 relative z-10">
            {isEditing ? (
              <>
                <RichTextInput
                  value={value}
                  onChange={setValue}
                  images={images}
                  onImagesChange={setImages}
                  placeholder="Tapez votre note ici…"
                  className={`min-h-[200px] mb-6 bg-transparent border-none focus-within:ring-0 focus-within:border-none text-gray-800 dark:text-gray-200 placeholder:text-gray-400/80 dark:placeholder:text-gray-500/70 ${handwritten.className} text-[18px] leading-[32px] tracking-[0.25px] selection:bg-yellow-200/60 dark:selection:bg-yellow-300/40 [&_p]:m-0 [&_div]:leading-[32px] [&_*]:leading-[32px]`}
                />
                <div className="flex items-center justify-start pt-5 border-t border-gray-200/60 dark:border-gray-700/60">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearNote}
                    disabled={!initialLoaded || (!value && images.length === 0)}
                    className="h-9 px-4 text-red-500 dark:text-red-400 hover:text-red-600 dark:hover:text-red-300 hover:bg-red-50/80 dark:hover:bg-red-950/30 border border-transparent hover:border-red-200/60 dark:hover:border-red-800/60 transition-all duration-300 rounded-xl shadow-sm hover:shadow-md backdrop-blur-sm"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Effacer
                  </Button>
                </div>
              </>
            ) : (
              <div className="max-w-none">
                <div className={`text-gray-800 dark:text-gray-200 relative ${handwritten.className} text-[18px] leading-[32px] tracking-[0.25px]`}>
                  <RichTextDisplay
                    content={value}
                    images={images}
                    enableImageZoom={true}
                    className="text-[17px] leading-[32px] text-gray-800 dark:text-gray-200 [&_p]:m-0 [&_p]:leading-[32px] [&_ul]:m-0 [&_ol]:m-0 [&_li]:leading-[32px]"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
