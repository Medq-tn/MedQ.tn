'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from './button';
import { Textarea } from './textarea';
import { Input } from './input';
import { Label } from './label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './dialog';
import { Image as ImageIcon, X, Edit2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useUploadThing } from '@/utils/uploadthing';

export interface ImageData {
  id: string;
  url: string;
  description: string;
}

interface RichTextInputProps {
  value: string;
  onChange: (value: string) => void;
  images?: ImageData[];
  onImagesChange?: (images: ImageData[]) => void;
  placeholder?: string;
  rows?: number;
  className?: string;
  disabled?: boolean;
  maxImageSize?: number; // in bytes, default 2MB
}

export function RichTextInput({
  value,
  onChange,
  images = [],
  onImagesChange,
  placeholder,
  rows = 4,
  className = '',
  disabled = false,
  maxImageSize = 4 * 1024 * 1024, // 4MB to match UploadThing
}: RichTextInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [editingImage, setEditingImage] = useState<ImageData | null>(null);
  const [imageEditForm, setImageEditForm] = useState({ url: '', description: '' });

  // Use UploadThing hook
  const { startUpload, isUploading } = useUploadThing("imageUploader", {
    onClientUploadComplete: (res) => {
      console.log("Files: ", res);
      if (res && res[0]) {
        insertImageAtCursor(res[0].url, res[0].name);
        toast({
          title: 'Image ajoutée',
          description: 'L\'image a été téléchargée et insérée dans le texte.',
        });
      }
    },
    onUploadError: (error: Error) => {
      console.error("Upload error:", error);
      toast({
        title: 'Erreur d\'upload',
        description: error.message || 'Impossible d\'ajouter l\'image.',
        variant: 'destructive',
      });
    },
  });

  // Generate unique image ID
  const generateImageId = () => `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Update images state helper
  const updateImages = (newImages: ImageData[]) => {
    if (onImagesChange) {
      onImagesChange(newImages);
    }
  };

  // One-time legacy placeholder migration: [IMAGE:url|description] -> [IMAGE:id]
  useEffect(() => {
    if (!value) return;
    // Detect legacy pattern
    const legacyRegex = /\[IMAGE:([^|]+)\|([^\]]+)\]/g;
    if (!legacyRegex.test(value)) return; // no legacy placeholders
    let working = value;
    const newImages: ImageData[] = [...images];
    // Reset regex lastIndex
    legacyRegex.lastIndex = 0;
    working = working.replace(legacyRegex, (_full, urlRaw, descRaw) => {
      const url = String(urlRaw).trim();
      const description = String(descRaw).trim();
      // Try to find existing image object by URL
      let existing = newImages.find(img => img.url === url);
      if (!existing) {
        existing = { id: generateImageId(), url, description };
        newImages.push(existing);
      }
      return `[IMAGE:${existing.id}]`;
    });
    if (working !== value) {
      updateImages(newImages);
      onChange(working);
    }
  // Intentionally exclude onChange/updateImages from deps to avoid re-run after conversion
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, images]);

  // Convert file to base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  const insertImageAtCursor = useCallback((imageUrl: string, description: string = '') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const cursorPos = textarea.selectionStart;
    const beforeCursor = value.substring(0, cursorPos);
    const afterCursor = value.substring(cursorPos);
    
    // Generate new image ID and add to images state
    const imageId = generateImageId();
    const newImage: ImageData = {
      id: imageId,
      url: imageUrl,
      description: description || 'Image'
    };
    
    const newImages = [...images, newImage];
    updateImages(newImages);
    
    const imageTag = `[IMAGE:${imageId}]`;
    const newValue = beforeCursor + imageTag + afterCursor;
    
    onChange(newValue);
    
    // Move cursor after the inserted image tag
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(cursorPos + imageTag.length, cursorPos + imageTag.length);
    }, 0);
  }, [value, onChange, images, updateImages]);

  const handleImageUpload = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Type de fichier non supporté',
        description: 'Veuillez sélectionner une image.',
        variant: 'destructive',
      });
      return;
    }

    if (file.size > maxImageSize) {
      toast({
        title: 'Image trop volumineuse',
        description: `La taille maximum est de ${Math.round(maxImageSize / (1024 * 1024))}MB.`,
        variant: 'destructive',
      });
      return;
    }

    try {
      // Show loading state
      toast({
        title: 'Upload en cours',
        description: 'Veuillez patienter...',
      });

      // Upload using UploadThing
      await startUpload([file]);
      
    } catch (error) {
      console.error('Error uploading image:', error);
      toast({
        title: 'Erreur',
        description: error instanceof Error ? error.message : 'Impossible d\'ajouter l\'image.',
        variant: 'destructive',
      });
    }
  }, [startUpload, maxImageSize, insertImageAtCursor]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleImageUpload(file);
    }
    // Reset input so same file can be selected again
    e.target.value = '';
  }, [handleImageUpload]);

  // Drag and drop functionality removed per user request

  const removeImage = useCallback((imageId: string) => {
    // Remove from images state
    const newImages = images.filter(img => img.id !== imageId);
    updateImages(newImages);
    
    // Remove from text
    const imagePattern = new RegExp(`\\[IMAGE:${imageId}\\]`, 'g');
    const newValue = value.replace(imagePattern, '');
    onChange(newValue);
  }, [value, onChange, images, updateImages]);

  const editImage = useCallback((imageId: string) => {
    const image = images.find(img => img.id === imageId);
    if (image) {
      setEditingImage(image);
      setImageEditForm({ url: image.url, description: image.description });
    }
  }, [images]);

  const saveImageEdit = useCallback(() => {
    if (!editingImage) return;
    
    const newImages = images.map(img => 
      img.id === editingImage.id 
        ? { ...img, url: imageEditForm.url, description: imageEditForm.description }
        : img
    );
    updateImages(newImages);
    setEditingImage(null);
    setImageEditForm({ url: '', description: '' });
    
    toast({
      title: 'Image mise à jour',
      description: 'Les informations de l\'image ont été sauvegardées.',
    });
  }, [editingImage, imageEditForm, images, updateImages]);

  const renderPreview = () => {
    if (!value && !images.length) return null;

    let displayText = value;
    
    // Split text around images for rendering - legacy converted above; fallback handling if any remain
    const parts: Array<{ type: 'text' | 'image'; content: string; imageId?: string }> = [];
    let lastIndex = 0;
    let processedText = value;

    // Fallback: handle any leftover legacy placeholders directly (should be rare after migration)
    if (/\[IMAGE:[^|\]]+\|[^\]]+\]/.test(processedText)) {
      const legacyRegex = /\[IMAGE:([^|]+)\|([^\]]+)\]/g;
      let m: RegExpExecArray | null;
      lastIndex = 0;
      while ((m = legacyRegex.exec(processedText)) !== null) {
        if (m.index > lastIndex) {
          parts.push({ type: 'text', content: processedText.substring(lastIndex, m.index) });
        }
        const url = m[1].trim();
        const desc = m[2].trim();
        // Create a transient image entry to reuse rendering path: push into images state only if editing allowed
        parts.push({ type: 'image', content: m[0], imageId: `legacy::${url}|${desc}` });
        lastIndex = m.index + m[0].length;
      }
      if (lastIndex < processedText.length) {
        parts.push({ type: 'text', content: processedText.substring(lastIndex) });
      }
      // Legacy handled; proceed to map below (will treat legacy specially)
    }

    // Process new format images [IMAGE:id]
  const newImagePattern = /\[IMAGE:([^\]]+)\]/g;
    let match;

    while ((match = newImagePattern.exec(processedText)) !== null) {
      // Add text before image
      if (match.index > lastIndex) {
        parts.push({
          type: 'text',
          content: processedText.substring(lastIndex, match.index)
        });
      }
      
      // Add new format image
      parts.push({
        type: 'image',
        content: match[0],
        imageId: match[1]
      });
      
      lastIndex = match.index + match[0].length;
    }
    
    // Add remaining text
    if (lastIndex < processedText.length) {
      parts.push({
        type: 'text',
        content: processedText.substring(lastIndex)
      });
    }

    if (parts.length === 0 && value) {
      parts.push({ type: 'text', content: value });
    }

    return (
      <div className="mt-2 p-3 border rounded-md bg-muted/30">
        <div className="text-xs font-medium mb-2 text-muted-foreground">Aperçu:</div>
        <div className="space-y-2">
          {parts.map((part, index) => (
            <div key={index}>
              {part.type === 'text' ? (
                <p className="whitespace-pre-wrap text-sm">{part.content}</p>
              ) : (
                <div className="relative inline-block max-w-full">
                  {(() => {
                    // Legacy fallback marker
                    if (part.imageId?.startsWith('legacy::')) {
                      const raw = part.imageId.slice('legacy::'.length);
                      const [url, desc] = raw.split('|');
                      return (
                        <div className="inline-flex flex-col items-start gap-1">
                          <img
                            src={url}
                            alt={desc}
                            className="max-w-full h-auto max-h-32 rounded border object-contain"
                          />
                          <span className="text-[10px] text-muted-foreground">(legacy)</span>
                        </div>
                      );
                    }
                    // Handle new format images
                    const imageData = images.find(img => img.id === part.imageId);
                    if (!imageData) {
                      const orphanId = part.imageId!;
                      return (
                        <div className="relative inline-flex flex-col gap-1 p-2 bg-amber-50/60 border border-amber-200 rounded min-w-[160px]">
                          <div className="text-[11px] text-amber-700 font-medium">Image introuvable</div>
                          <div className="text-[10px] text-amber-600 truncate max-w-[140px]">ID: {orphanId}</div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-6 px-2 text-[11px] bg-white"
                            onClick={() => {
                              // Create empty image entry so user can edit & attach URL
                              const newImg: ImageData = { id: orphanId, url: '', description: '' };
                              updateImages([...images, newImg]);
                              // Immediately open editor
                              editImage(orphanId);
                            }}
                          >
                            Associer une image
                          </Button>
                          <div className="text-[10px] text-muted-foreground leading-tight">Ancien enregistrement sans métadonnées. Ajoutez l'URL.</div>
                        </div>
                      );
                    }

                    return (
                      <>
                        <img
                          src={imageData.url}
                          alt={imageData.description}
                          className="max-w-full h-auto max-h-32 rounded border object-contain cursor-pointer"
                          onClick={() => editImage(imageData.id)}
                          title={`Cliquer pour éditer: ${imageData.description}`}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => editImage(imageData.id)}
                          className="absolute top-1 left-1 h-6 w-6 p-0 bg-blue-500 hover:bg-blue-600"
                        >
                          <Edit2 className="h-3 w-3 text-white" />
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          onClick={() => removeImage(imageData.id)}
                          className="absolute top-1 right-1 h-6 w-6 p-0"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </>
                    );
                  })()}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-2">
      <div className="relative">
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={rows}
          className={`${className}`}
          disabled={disabled}
        />
      </div>
      
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || isUploading}
        >
          <ImageIcon className="h-4 w-4 mr-2" />
          {isUploading ? 'Upload en cours...' : 'Insérer une image'}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
        />
        <span className="text-xs text-muted-foreground">
          Format maximum: 4MB
        </span>
      </div>

      {renderPreview()}

      <div className="text-xs text-muted-foreground">
        <p>💡 Les images seront insérées à la position du curseur dans le texte.</p>
        <p>Format technique: [IMAGE:id] - cliquez sur l'image pour modifier l'URL et la description.</p>
      </div>

      {/* Image Edit Dialog */}
      <Dialog open={!!editingImage} onOpenChange={() => setEditingImage(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Modifier l'image</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="imageUrl">URL de l'image</Label>
              <Input
                id="imageUrl"
                value={imageEditForm.url}
                onChange={(e) => setImageEditForm(prev => ({ ...prev, url: e.target.value }))}
                placeholder="https://example.com/image.jpg ou data:image/..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="imageDescription">Description</Label>
              <Input
                id="imageDescription"
                value={imageEditForm.description}
                onChange={(e) => setImageEditForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Description de l'image"
              />
            </div>
            {imageEditForm.url && (
              <div className="mt-4">
                <Label>Aperçu</Label>
                <img
                  src={imageEditForm.url}
                  alt={imageEditForm.description}
                  className="mt-2 max-w-full h-auto max-h-32 rounded border object-contain"
                  onError={() => toast({ title: 'URL invalide', description: 'L\'image ne peut pas être chargée.', variant: 'destructive' })}
                />
              </div>
            )}
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setEditingImage(null)}>
                Annuler
              </Button>
              <Button onClick={saveImageEdit} disabled={!imageEditForm.url.trim()}>
                Sauvegarder
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
