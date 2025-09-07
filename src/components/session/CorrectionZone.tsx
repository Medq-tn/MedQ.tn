"use client";

import { useState, useEffect } from 'react';
import { SessionCorrectionData, SessionCorrectionSubmission } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Plus, Save, UploadCloud, Table as TableIcon, PenLine, CheckCircle, Loader2, Eye, EyeOff, ClipboardList, Trash2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';

interface CorrectionZoneProps {
  sessionId: string;
  mode: 'admin' | 'maintainer' | 'student';
}

// Empty template
const emptyData: SessionCorrectionData = { tables: [], texts: [] };

export function CorrectionZone({ sessionId, mode }: CorrectionZoneProps) {
  const isEditor = mode === 'admin' || mode === 'maintainer';
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false); // still used to persist user answers, no scoring
  // showReference: for editors default to true, for students false. In test mode for editors we start hidden like a student.
  const [showReference, setShowReference] = useState(isEditor);
  const [data, setData] = useState<SessionCorrectionData>(emptyData);
  const [userAnswers, setUserAnswers] = useState<SessionCorrectionSubmission['answers']>({ tables: [], texts: [] });
  // Scoring removed – we only persist answers now
  // Auto-save helpers
  const [dirty, setDirty] = useState(false);
  const [autoSaving, setAutoSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  // Editor test mode: allow admin/maintainer to simulate student experience (no editing, reference hidden by default, can toggle like student)
  const [editorTestMode, setEditorTestMode] = useState(false);
  const canEdit = isEditor && !editorTestMode; // replace isEditor checks for edit capabilities

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/sessions/${sessionId}/correction?withSubmission=1`, { cache: 'no-store' });
        if (res.ok) {
          const json = await res.json();
          if (!cancelled) {
            if (json.correction?.data) setData(json.correction.data as SessionCorrectionData);
            if (json.submission?.answers) setUserAnswers(json.submission.answers);
          }
        }
      } catch (e) {
        console.error('Load correction zone error', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [sessionId]);

  const markDirty = () => setDirty(true);

  const addTable = () => {
    setData(d => ({ ...d, tables: [...d.tables, { id: crypto.randomUUID(), title: 'QCM', headers: ['Question', 'Réponse'], rows: [['','']], compareMode: 'exact' }] }));
    markDirty();
  };
  const addText = () => {
    setData(d => ({ ...d, texts: [...d.texts, { id: crypto.randomUUID(), title: 'Question', reference: '', keywords: [], scoring: { full: 1 } }] }));
    markDirty();
  };

  // Delete functions
  const deleteTable = (tableId: string) => {
    setData(d => ({ ...d, tables: d.tables.filter(t => t.id !== tableId) }));
    markDirty();
  };
  const deleteText = (textId: string) => {
    setData(d => ({ ...d, texts: d.texts.filter(t => t.id !== textId) }));
    markDirty();
  };
  const deleteTableColumn = (tableId: string, columnIndex: number) => {
    setData(d => ({ 
      ...d, 
      tables: d.tables.map(t => t.id === tableId ? {
        ...t,
        headers: t.headers.filter((_, i) => i !== columnIndex),
        rows: t.rows.map(r => r.filter((_, i) => i !== columnIndex))
      } : t)
    }));
    markDirty();
  };
  const deleteTableRow = (tableId: string, rowIndex: number) => {
    setData(d => ({ 
      ...d, 
      tables: d.tables.map(t => t.id === tableId ? {
        ...t,
        rows: t.rows.filter((_, i) => i !== rowIndex)
      } : t)
    }));
    markDirty();
  };

  const updateTableHeader = (tableId: string, index: number, value: string) => {
    setData(d => ({ ...d, tables: d.tables.map(t => t.id === tableId ? { ...t, headers: t.headers.map((h,i)=> i===index? value : h), rows: t.rows.map(r => { const copy = [...r]; while (copy.length < t.headers.length) copy.push(''); return copy.slice(0, t.headers.length); }) } : t) }));
    markDirty();
  };
  const addTableColumn = (tableId: string) => {
    setData(d => ({ ...d, tables: d.tables.map(t => t.id === tableId ? { ...t, headers: [...t.headers, `Colonne${t.headers.length+1}`], rows: t.rows.map(r => [...r, '']) } : t) }));
    markDirty();
  };
  const addTableRow = (tableId: string) => {
    setData(d => ({ ...d, tables: d.tables.map(t => t.id === tableId ? { ...t, rows: [...t.rows, new Array(t.headers.length).fill('')] } : t) }));
    markDirty();
  };
  const updateTableCell = (tableId: string, r: number, c: number, value: string, isReference: boolean) => {
    if (isReference) {
      setData(d => ({ ...d, tables: d.tables.map(t => t.id === tableId ? { ...t, rows: t.rows.map((row, ri) => ri===r ? row.map((cell, ci) => ci===c ? value : cell) : row) } : t) }));
    } else {
      setUserAnswers(ans => {
        let table = ans.tables.find(t => t.id === tableId);
        if (!table) { table = { id: tableId, rows: [] }; ans = { ...ans, tables: [...ans.tables, table] }; }
        const rows = [...table.rows];
        if (!rows[r]) rows[r] = [];
        const row = [...rows[r]]; row[c] = value; rows[r] = row;
        const newTables = ans.tables.map(t => t.id === tableId ? { ...t, rows } : t);
        return { ...ans, tables: newTables };
      });
    }
    markDirty();
  };

  const updateTextReference = (id: string, value: string) => {
    setData(d => ({ ...d, texts: d.texts.map(t => t.id === id ? { ...t, reference: value } : t) }));
    markDirty();
  };
  const updateTextAnswer = (id: string, value: string) => {
    setUserAnswers(a => {
      const existing = a.texts.find(t => t.id === id);
      if (existing) {
        return { ...a, texts: a.texts.map(t => t.id === id ? { ...t, answer: value } : t) };
      }
      return { ...a, texts: [...a.texts, { id, answer: value }] };
    });
    markDirty();
  };

  const saveCorrection = async () => {
    try {
      setSaving(true);
      const res = await fetch(`/api/sessions/${sessionId}/correction`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data }) });
      if (!res.ok) throw new Error('Save failed');
      setDirty(false);
      setLastSavedAt(new Date());
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  // Debounced auto-save for editors (disabled in test mode)
  useEffect(() => {
    if (!canEdit) return;
    if (!dirty) return;
    const handle = setTimeout(async () => {
      try {
        setAutoSaving(true);
        const res = await fetch(`/api/sessions/${sessionId}/correction`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data }) });
        if (res.ok) {
          setDirty(false);
          setLastSavedAt(new Date());
        }
      } catch (e) {
        console.error('Auto-save failed', e);
      } finally {
        setAutoSaving(false);
      }
    }, 1500);
    return () => clearTimeout(handle);
  }, [dirty, data, canEdit, sessionId]);

  // Toggle editor test mode
  const toggleEditorTestMode = () => {
    setEditorTestMode(m => {
      const next = !m;
      // entering test mode => hide reference (student initial state). Exiting => show reference.
      if (next) {
        setShowReference(false);
      } else {
        setShowReference(true);
      }
      return next;
    });
  };

  const submitAnswers = async () => {
    try {
      setSubmitting(true);
      await fetch(`/api/sessions/${sessionId}/correction`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ answers: userAnswers }) });
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Card className="border-border/50 bg-white/50 dark:bg-muted/30 backdrop-blur-sm shadow-lg">
        <CardContent className="py-12 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-blue-600 dark:text-blue-400" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4 w-full max-w-full overflow-hidden">
      {/* Actions / header card */}
  <Card className="border border-gray-200 dark:border-gray-700 bg-white/70 dark:bg-gray-800/60 backdrop-blur-sm shadow-sm">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-primary/40 via-primary/10 to-primary/40" />
        <CardHeader className="pb-3 px-4 sm:px-6">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg font-semibold bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent">
            <CheckCircle className="h-5 w-5 text-primary flex-shrink-0" />
            <span>Zone de Correction</span>
            {isEditor && !editorTestMode && (
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-md hidden sm:inline bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-100 border border-gray-300/70 dark:border-gray-600/70">
                (éditeur)
              </span>
            )}
            {isEditor && editorTestMode && (
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-md hidden sm:inline bg-amber-500 text-white dark:bg-amber-400 dark:text-gray-900 border border-amber-600/60 dark:border-amber-300/60 shadow-sm">
                (mode test)
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 space-y-4">
          <div className="flex gap-2 flex-wrap items-center justify-center sm:justify-start">
            {isEditor && (
              <>
                {canEdit && (
                  <Button size="sm" variant="outline" onClick={addTable} className="gap-2 bg-card/70 hover:bg-accent border-border min-w-[100px]">
                  <ClipboardList className="h-4 w-4" /> 
                  <span className="hidden sm:inline">Ajouter</span> QCM
                  </Button>
                )}
                {canEdit && (
                  <Button size="sm" variant="outline" onClick={addText} className="gap-2 bg-card/70 hover:bg-accent border-border min-w-[100px]">
                  <PenLine className="h-4 w-4" /> 
                  <span className="hidden sm:inline">Ajouter</span> Texte
                  </Button>
                )}
                {canEdit && (
                  <div className="flex items-center gap-2">
                    <Button size="sm" onClick={saveCorrection} disabled={saving || autoSaving} className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground min-w-[120px] disabled:opacity-70">
                      {(saving || autoSaving) ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} 
                      {(saving || autoSaving) ? 'Sauvegarde…' : 'Sauvegarder'}
                    </Button>
                    {lastSavedAt && !dirty && !saving && !autoSaving && (
                      <span className="text-[10px] text-primary font-medium">Sauvegardé {lastSavedAt.toLocaleTimeString()}</span>
                    )}
                    {dirty && !saving && !autoSaving && (
                      <span className="text-[10px] text-warning font-medium">Modifications non sauvegardées…</span>
                    )}
                  </div>
                )}
                <Button size="sm" variant={editorTestMode ? 'destructive' : 'secondary'} onClick={toggleEditorTestMode} className={cn('gap-2 min-w-[140px]', editorTestMode ? 'bg-warning hover:bg-warning/90 text-warning-foreground' : 'bg-secondary hover:bg-secondary/80 border-border')}
                >
                  {editorTestMode ? 'Quitter test' : 'Tester (étudiant)'}
                </Button>
              </>
            )}
            {(!isEditor || editorTestMode) && data && (
              <Button size="sm" variant="outline" onClick={() => setShowReference(r=>!r)} className="gap-2 bg-card/70 hover:bg-accent border-border min-w-[100px]">
                {showReference ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                {showReference ? 'Masquer' : 'Voir'}
              </Button>
            )}
          </div>

          {/* Scoring UI removed */}
        </CardContent>
      </Card>

      {/* Tables */}
      {data.tables.map(table => {
        const userTable = userAnswers.tables.find(t => t.id === table.id);
        return (
          <Card key={table.id} className="border border-gray-200 dark:border-gray-700 bg-white/70 dark:bg-gray-800/60 backdrop-blur-sm shadow-sm">
            <CardHeader className="pb-3 space-y-3 px-4 sm:px-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 text-gray-900 dark:text-gray-100 min-w-0 flex-1">
                  <ClipboardList className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                  <Input
                    value={table.title || ''}
          disabled={!canEdit}
                    onChange={e => setData(d => ({ ...d, tables: d.tables.map(t => t.id === table.id ? { ...t, title: e.target.value } : t) }))}
                    placeholder="Titre du QCM"
                    className="h-8 min-w-0 flex-1 max-w-sm bg-white/80 dark:bg-gray-800/50 border-gray-300 dark:border-gray-600 focus:ring-blue-500"
                  />
                </CardTitle>
        {canEdit && (
                  <div className="flex gap-2 flex-wrap">
                    <Button size="sm" variant="outline" onClick={() => addTableColumn(table.id)} className="gap-1 text-xs bg-white/70 dark:bg-gray-800/40 hover:bg-gray-100 dark:hover:bg-gray-700 border-gray-300 dark:border-gray-600">
                      <Plus className="h-3 w-3" />
                      Colonne
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => addTableRow(table.id)} className="gap-1 text-xs bg-white/70 dark:bg-gray-800/40 hover:bg-gray-100 dark:hover:bg-gray-700 border-gray-300 dark:border-gray-600">
                      <Plus className="h-3 w-3" />
                      Ligne
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => deleteTable(table.id)} className="gap-1 text-xs bg-red-500 hover:bg-red-600 text-white">
                      <Trash2 className="h-3 w-3" />
                      Supprimer
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto max-w-full">
                <div className="p-4 min-w-max">
                  <table className="table-auto text-sm border-collapse">
                    <thead>
                      <tr>
                        {canEdit && <th className="border border-gray-300 dark:border-gray-600 w-8 bg-gray-100 dark:bg-gray-800/50"></th>}
                        {table.headers.map((h,i) => (
                          <th key={i} className="border border-gray-300 dark:border-gray-600 px-2 py-2 bg-gray-100 dark:bg-gray-800/50 min-w-[80px] max-w-[150px] w-auto relative">
              {canEdit ? (
                              <div className="space-y-1">
                                <div className="flex items-center gap-1">
                                  <Input 
                                    value={h} 
                                    onChange={e => updateTableHeader(table.id, i, e.target.value)}
                                    className="h-7 text-xs bg-white/80 dark:bg-gray-800/50 border-gray-300 dark:border-gray-600 focus:ring-blue-500 min-w-0 flex-1" 
                                    placeholder="En-tête"
                                  />
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => deleteTableColumn(table.id, i)}
                                    className="h-6 w-6 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                                    title="Supprimer cette colonne"
                                  >
                                    <X className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <span className="font-medium text-gray-900 dark:text-gray-100 text-center block text-xs">{h}</span>
                            )}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
            {table.rows.map((row, ri) => (
                        <tr key={ri}>
              {canEdit && (
                            <td className="border border-gray-300 dark:border-gray-600 w-8 bg-gray-100 dark:bg-gray-800/50 text-center">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => deleteTableRow(table.id, ri)}
                                className="h-6 w-6 p-0 text-destructive hover:bg-destructive/10"
                                title="Supprimer cette ligne"
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </td>
                          )}
                          {row.map((cell, ci) => {
                            const headerLabel = table.headers[ci] || '';
                            const isQuestionCol = ci === 0 || /question/i.test(headerLabel);
                            const userVal = userTable?.rows?.[ri]?.[ci] || '';
            const showRef = showReference || canEdit;
                            // For students: Question column always shows reference (cell) and is locked.
                            if ((!isEditor || editorTestMode) && isQuestionCol) {
                              return (
                                <td key={ci} className="border border-gray-300 dark:border-gray-600 px-1 py-1 align-top bg-white/70 dark:bg-gray-800/40 min-w-[140px] max-w-[240px] w-auto">
                                  <div className="text-[11px] sm:text-xs text-gray-900 dark:text-gray-100 whitespace-pre-wrap">
                                    {cell || ''}
                                  </div>
                                </td>
                              );
                            }
            const isEditable = canEdit || !showRef; // unchanged logic for other columns
                            const displayVal = showRef ? cell : userVal;
                            // Highlight correctness only for students/test mode when reference is shown and not a question column
                            const shouldEvaluate = showRef && !canEdit && !isQuestionCol;
                            const normalize = (v: string) => v.trim().toLowerCase();
                            const isCorrect = shouldEvaluate && userVal !== '' && normalize(userVal) === normalize(cell);
                            const isIncorrect = shouldEvaluate && userVal !== '' && !isCorrect && cell.trim() !== '';
                            const highlightClasses = isCorrect
                              ? 'bg-success/10 border-success/40'
                              : isIncorrect
                                ? 'bg-destructive/10 border-destructive/40'
                                : 'bg-card/60';
                            return (
                              <td
                                key={ci}
                                className={cn(
                                  'border px-1 py-1 align-top min-w-[80px] max-w-[150px] w-auto',
                                  highlightClasses,
                                  // keep original border color fallback when no correctness highlight
                                  !isCorrect && !isIncorrect && 'border-border'
                                )}
                              >
                                <Input
                                  value={isEditable ? (showRef ? (canEdit ? cell : userVal) : userVal) : displayVal}
                                  readOnly={!isEditable}
                                  onChange={e => updateTableCell(table.id, ri, ci, e.target.value, showRef && canEdit)}
                                  className="h-7 text-xs bg-white/80 dark:bg-gray-800/50 border-0 focus:ring-1 focus:ring-blue-500 w-full min-w-0"
                                  placeholder={isEditor ? (isQuestionCol ? 'Question' : 'Valeur') : 'Votre réponse'}
                                />
                                {shouldEvaluate && (
                                  <div className={cn('mt-1 text-[10px] leading-tight', isCorrect ? 'text-success' : isIncorrect ? 'text-destructive' : 'text-muted-foreground/70')}> 
                                    {isCorrect ? 'Correct' : isIncorrect ? 'Incorrect' : (userVal ? 'Référence affichée' : 'Aucune réponse')}
                                  </div>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}

      {/* Text blocks */}
      {data.texts.map(txt => {
        const userTxt = userAnswers.texts.find(t => t.id === txt.id);
        return (
          <Card key={txt.id} className="border border-gray-200 dark:border-gray-700 bg-white/70 dark:bg-gray-800/60 backdrop-blur-sm shadow-sm">
            <CardHeader className="pb-3 px-4 sm:px-6">
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 text-gray-900 dark:text-gray-100 min-w-0 flex-1">
                  <PenLine className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                  <Input
                    value={txt.title || ''}
        disabled={!canEdit}
                    onChange={e => setData(d => ({ ...d, texts: d.texts.map(t => t.id === txt.id ? { ...t, title: e.target.value } : t) }))}
                    placeholder="Titre de la zone"
                    className="h-8 min-w-0 flex-1 max-w-sm bg-white/80 dark:bg-gray-800/50 border-gray-300 dark:border-gray-600 focus:ring-blue-500"
                  />
                </CardTitle>
        {canEdit && (
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => deleteText(txt.id)}
                    className="gap-1 text-xs bg-red-500 hover:bg-red-600 text-white flex-shrink-0"
                  >
                    <Trash2 className="h-3 w-3" />
                    Supprimer
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-3 px-4 sm:px-6">
            {showReference || canEdit ? (
                <div className="space-y-2">
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Réponse de référence</label>
                  <Textarea
                    value={txt.reference}
        onChange={e => updateTextReference(txt.id, e.target.value)}
        readOnly={!canEdit}
                    placeholder="Réponse officielle"
                    rows={4}
                    className="bg-gray-100/80 dark:bg-gray-800/40 border-gray-300 dark:border-gray-600 focus:ring-blue-500"
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Votre réponse</label>
                  <Textarea
                    value={userTxt?.answer || ''}
                    onChange={e => updateTextAnswer(txt.id, e.target.value)}
                    placeholder="Votre réponse"
                    rows={4}
                    className="bg-white/80 dark:bg-gray-800/50 border-gray-300 dark:border-gray-600 focus:ring-blue-500"
                  />
                </div>
              )}
            {(!isEditor || editorTestMode) && showReference && (
                <div className="space-y-2">
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Votre réponse</label>
                  <Textarea
                    value={userTxt?.answer || ''}
                    onChange={e => updateTextAnswer(txt.id, e.target.value)}
                    placeholder="Votre réponse"
                    rows={4}
                    className="bg-white/80 dark:bg-gray-800/50 border-gray-300 dark:border-gray-600 focus:ring-blue-500"
                  />
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}

  {(!isEditor || editorTestMode) && (data.tables.length > 0 || data.texts.length > 0) && (
  <Card className="border border-gray-200 dark:border-gray-700 bg-white/70 dark:bg-gray-800/60 backdrop-blur-sm shadow-sm">
          <CardContent className="pt-4 pb-4 px-4 sm:px-6">
            <div className="flex justify-center">
              <Button size="sm" onClick={submitAnswers} disabled={submitting} className="gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 w-full sm:w-auto min-w-[160px]">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />} 
                <span>Enregistrer Réponses</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {!loading && data.tables.length === 0 && data.texts.length === 0 && (
  <Card className="border border-gray-200 dark:border-gray-700 bg-white/70 dark:bg-gray-800/60 backdrop-blur-sm shadow-sm">
          <CardContent className="py-8 sm:py-12 text-center px-4 sm:px-6">
            <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl bg-gray-100 dark:bg-gray-800/50 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600 dark:text-blue-400" />
            </div>
            <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
              {canEdit ? 'Aucune correction créée. Ajoutez des QCM ou des zones de texte.' : 'Aucune correction disponible pour cette session.'}
            </p>
            {canEdit && (
              <div className="flex gap-2 justify-center flex-wrap">
                <Button size="sm" variant="outline" onClick={addTable} className="gap-2 min-w-[120px]">
                  <ClipboardList className="h-4 w-4" /> Ajouter QCM
                </Button>
                <Button size="sm" variant="outline" onClick={addText} className="gap-2 min-w-[120px]">
                  <PenLine className="h-4 w-4" /> Ajouter Texte
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
