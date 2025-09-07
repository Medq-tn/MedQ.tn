"use client";

import { useState, useEffect, useRef } from 'react';
import { ClinicalCase, Question } from '@/types';
import { MCQQuestion } from './MCQQuestion';
import { OpenQuestion } from './OpenQuestion';
import { QuestionNotes } from './QuestionNotes';
import { QuestionComments } from './QuestionComments';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { CheckCircle, Circle, AlertCircle, Eye, FileText, Pin, PinOff, EyeOff, Trash2, Pencil, StickyNote, ChevronRight, Flag } from 'lucide-react';
import { ReportQuestionDialog } from './ReportQuestionDialog';
import { HighlightableCaseText } from './HighlightableCaseText';
import { RichTextDisplay } from '@/components/ui/rich-text-display';
import { ClinicalCaseEditDialog } from './edit/ClinicalCaseEditDialog';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from 'react-i18next';

interface ClinicalCaseQuestionProps {
  clinicalCase: ClinicalCase;
  onSubmit: (caseNumber: number, answers: Record<string, any>, results: Record<string, boolean | 'partial'>) => void;
  onNext: () => void;
  lectureId: string;
  lectureTitle?: string;
  specialtyName?: string;
  isAnswered: boolean;
  answerResult?: boolean | 'partial';
  userAnswers?: Record<string, any>;
  answerResults?: Record<string, boolean | 'partial'>;
  onAnswerUpdate?: (questionId: string, answer: any, result?: boolean | 'partial') => void;
}

export function ClinicalCaseQuestion({
  clinicalCase,
  onSubmit,
  onNext,
  lectureId,
  lectureTitle,
  specialtyName,
  isAnswered,
  answerResult,
  userAnswers = {},
  answerResults = {},
  onAnswerUpdate
}: ClinicalCaseQuestionProps) {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [answers, setAnswers] = useState<Record<string, any>>(userAnswers);
  const [questionResults, setQuestionResults] = useState<Record<string, boolean | 'partial'>>(answerResults);
  const [isCaseComplete, setIsCaseComplete] = useState(isAnswered);
  const [showResults, setShowResults] = useState(isAnswered);
  const [showCaseDialog, setShowCaseDialog] = useState(false);
  const [groupPinned, setGroupPinned] = useState(false);
  const [groupHidden, setGroupHidden] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isTogglingHidden, setIsTogglingHidden] = useState(false);
  const [showNotesArea, setShowNotesArea] = useState(false);
  const [notesHasContent, setNotesHasContent] = useState(false); // track if notes have content

  // Auto-close notes when content becomes empty
  useEffect(() => {
    if (!notesHasContent) {
      setShowNotesArea(false);
    }
  }, [notesHasContent]);
  const [openCaseEdit, setOpenCaseEdit] = useState(false);
  const [isReportDialogOpen, setIsReportDialogOpen] = useState(false);
  const [reportTargetQuestion, setReportTargetQuestion] = useState<Question | null>(null);
  const questionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const answeredQuestions = Object.keys(answers).length;
  const progress = (answeredQuestions / clinicalCase.totalQuestions) * 100;

  useEffect(() => {
    if (!isAnswered) {
      setAnswers({});
      setQuestionResults({});
      setIsCaseComplete(false);
      setShowResults(false);
    }
  }, [clinicalCase.caseNumber, isAnswered]);

  // Always reset scroll to top when a clinical case loads (avoid starting mid-page)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Use rAF to run after layout for consistency
      requestAnimationFrame(() => {
        if (window.scrollY > 0) {
          window.scrollTo({ top: 0, behavior: 'auto' });
        }
      });
    }
  }, [clinicalCase.caseNumber]);

  useEffect(() => {
    const fetchPinned = async () => {
      try {
        if (!user?.id) return;
        const res = await fetch(`/api/pinned-questions?userId=${user.id}`);
        if (!res.ok) return;
        const data = await res.json();
        const pinnedSet = new Set(data.map((d: any) => d.questionId));
        const anyPinned = clinicalCase.questions.some(q => pinnedSet.has(q.id));
        setGroupPinned(anyPinned);
      } catch {}
    };
    fetchPinned();
    const allHidden = clinicalCase.questions.every(q => (q as any).hidden);
    setGroupHidden(allHidden);
  }, [clinicalCase.questions, user?.id]);

  const toggleGroupPin = async () => {
    if (!user?.id) return;
    try {
      for (const q of clinicalCase.questions) {
        if (!groupPinned) {
          await fetch('/api/pinned-questions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: user.id, questionId: q.id }) });
        } else {
          await fetch(`/api/pinned-questions?userId=${user.id}&questionId=${q.id}`, { method: 'DELETE' });
        }
      }
      setGroupPinned(!groupPinned);
    } catch {}
  };

  const toggleGroupHidden = async () => {
    if (!(user?.role === 'admin' || user?.role === 'maintainer')) return;
    setIsTogglingHidden(true);
    try {
      for (const q of clinicalCase.questions) {
        await fetch(`/api/questions/${q.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ hidden: !groupHidden }) });
      }
      setGroupHidden(!groupHidden);
    } catch {}
    setIsTogglingHidden(false);
  };

  const handleDeleteGroup = async () => {
    if (!user?.role || user.role !== 'admin') return;
    if (!confirm('Supprimer tout le cas clinique (toutes les sous-questions) ?')) return;
    setIsDeleting(true);
    try {
      for (const q of clinicalCase.questions) {
        await fetch(`/api/questions/${q.id}`, { method: 'DELETE', credentials: 'include' });
      }
      window.location.reload();
    } catch {
      setIsDeleting(false);
    }
  };

  const scrollToNextQuestion = (currentQuestionId: string, updatedAnswers: Record<string, any>) => {
    const currentIndex = clinicalCase.questions.findIndex(q => q.id === currentQuestionId);
    for (let i = currentIndex + 1; i < clinicalCase.questions.length; i++) {
      const nextQuestion = clinicalCase.questions[i];
      if (updatedAnswers[nextQuestion.id] === undefined) {
        const element = questionRefs.current[nextQuestion.id];
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'start', inline: 'nearest' });
          // Focus the first input in the next question after scrolling
          setTimeout(() => {
            const firstInput = element.querySelector('input[type="radio"], textarea') as HTMLElement;
            if (firstInput) {
              firstInput.focus();
            }
          }, 500);
        }
        break;
      }
    }
  };

  const handleQuestionAnswer = (questionId: string, answer: any, result?: boolean | 'partial') => {
    const wasAnswered = answers[questionId] !== undefined;
    setAnswers(prev => {
      const newAnswers = { ...prev, [questionId]: answer };
      if (!wasAnswered && !showResults) {
        setTimeout(() => scrollToNextQuestion(questionId, newAnswers), 300);
      }
      return newAnswers;
    });
    if (result !== undefined) {
      setQuestionResults(prev => ({ ...prev, [questionId]: result }));
    }
  };

  const handleCompleteCase = () => {
    setIsCaseComplete(true);
    setShowResults(true); // Automatically show results after submission
    onSubmit(clinicalCase.caseNumber, answers, questionResults);
  };
  const handleShowResults = () => setShowResults(true);
  const handleSelfAssessmentUpdate = (questionId: string, result: boolean | 'partial') => {
    setQuestionResults(prev => ({ ...prev, [questionId]: result }));
    if (onAnswerUpdate) {
      const userAnswer = answers[questionId];
      onAnswerUpdate(questionId, userAnswer, result);
    }
  };

  // Add keyboard navigation for Enter key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        const target = e.target as HTMLElement;
        
        // If it's a textarea (QROC answer), submit the current question
        if (target.tagName === 'TEXTAREA') {
          e.preventDefault();
          const questionCard = target.closest('[data-question-id]');
          if (questionCard) {
            const questionId = questionCard.getAttribute('data-question-id');
            if (questionId && answers[questionId] !== undefined) {
              // Move to next unanswered question or trigger completion
              const nextUnanswered = clinicalCase.questions.find(q => answers[q.id] === undefined);
              if (nextUnanswered) {
                const element = questionRefs.current[nextUnanswered.id];
                if (element) {
                  element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  setTimeout(() => {
                    const firstInput = element.querySelector('input[type="radio"], textarea') as HTMLElement;
                    if (firstInput) firstInput.focus();
                  }, 300);
                }
              } else if (answeredQuestions === clinicalCase.totalQuestions && !isCaseComplete) {
                // All questions answered, trigger completion
                handleCompleteCase();
              }
            }
          }
        }
        
        // Handle workflow buttons
        if (answeredQuestions === clinicalCase.totalQuestions && !isCaseComplete) {
          handleCompleteCase();
        } else if (isCaseComplete && !showResults) {
          handleShowResults();
        } else if (isCaseComplete && showResults) {
          onNext();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [answers, answeredQuestions, isCaseComplete, showResults, clinicalCase.questions, clinicalCase.totalQuestions, handleCompleteCase, handleShowResults, onNext]);
  const getQuestionStatus = (question: Question) => {
    if (answers[question.id] !== undefined) {
      if (showResults) {
        const result = questionResults[question.id];
        if (result === true) return 'correct';
        if (result === 'partial') return 'partial';
        return 'incorrect';
      }
      return 'answered';
    }
    return 'unanswered';
  };
  const renderQuestion = (question: Question, index: number) => {
    const isAnsweredQ = answers[question.id] !== undefined;
    const answerResultQ = showResults ? questionResults[question.id] : undefined;
    const userAnswerQ = answers[question.id];
    return (
      <div key={question.id} ref={el => { questionRefs.current[question.id] = el; }} className="border rounded-xl p-3 bg-card shadow-sm" data-question-id={question.id}>
        <div className="flex items-center mb-2">
          <span
            className={
              'inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold tracking-wide ' +
              (isAnsweredQ
                ? showResults
                  ? answerResultQ === true
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                    : answerResultQ === 'partial'
                      ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300'
                      : answerResultQ === false
                        ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                        : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                  : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                : 'bg-muted text-muted-foreground')
            }
          >
            Question {index + 1}
          </span>
          {isAnsweredQ && (
            <span className="ml-auto inline-flex items-center">
              {showResults ? (
                <>
                  {answerResultQ === true && <CheckCircle className="h-4 w-4 text-green-600" />}
                  {answerResultQ === 'partial' && <AlertCircle className="h-4 w-4 text-yellow-600" />}
                  {answerResultQ === false && <AlertCircle className="h-4 w-4 text-red-600" />}
                </>
              ) : (
                <Circle className="h-4 w-4 text-blue-600" />
              )}
            </span>
          )}
        </div>
        {question.type === 'clinic_mcq' ? (
          <MCQQuestion
            question={question}
            onSubmit={(answer, isCorrect) => handleQuestionAnswer(question.id, answer, isCorrect)}
            onAnswerChange={(answer, isCorrect) => handleQuestionAnswer(question.id, answer, isCorrect)}
            onNext={() => {}}
            lectureId={lectureId}
            lectureTitle={lectureTitle}
            specialtyName={specialtyName}
            isAnswered={showResults ? isAnsweredQ : false}
            answerResult={showResults ? answerResultQ : undefined}
            userAnswer={userAnswerQ as any}
            hideImmediateResults={!showResults}
            hideActions
            hideNotes={!showResults} // Notes only after results
            hideComments={true} // Always hide individual question comments in clinical cases
            highlightConfirm
            hideMeta
            suppressReminder={true} // Hide "Rappel du cours" in clinical cases
            enableOptionHighlighting={true} // Enable highlighting for MCQ options
          />
        ) : (
          <OpenQuestion
            question={question}
            onSubmit={(answer, resultValue) => handleQuestionAnswer(question.id, answer, resultValue)}
            onAnswerChange={(answer, hasAnswer) => {
              // For QROC questions, we call handleQuestionAnswer with answer and placeholder result
              // The actual result will be determined during self-assessment
              handleQuestionAnswer(question.id, answer, 'partial');
            }}
            onNext={() => {}}
            lectureId={lectureId}
            lectureTitle={lectureTitle}
            specialtyName={specialtyName}
            isAnswered={showResults ? isAnsweredQ : false}
            answerResult={showResults ? answerResultQ : undefined}
            userAnswer={userAnswerQ as any}
            hideImmediateResults={!showResults}
            showDeferredSelfAssessment={showResults && isAnsweredQ && question.type === 'clinic_croq'}
            onSelfAssessmentUpdate={handleSelfAssessmentUpdate}
            hideNotes={!showResults}
            hideComments={true} // Always hide individual question comments in clinical cases
            hideActions
            highlightConfirm
            hideMeta
            suppressReminder={true} // Hide "Rappel du cours" in clinical cases
            enableAnswerHighlighting={true} // Enable highlighting for user answers
          />
        )}
      </div>
    );
  };

  return (
    <div 
      className="space-y-2 w-full max-w-full" 
      data-clinical-case
    >
      <Card>
        <CardHeader className="pb-3">
          <div className="space-y-2 w-full">
            {(() => {
              const firstQuestion = clinicalCase.questions[0];
              const session = firstQuestion?.session;
              const parts: string[] = ['Cas Clinique', `${clinicalCase.caseNumber}`];
              if (session) {
                const hasWord = /session/i.test(session);
                parts.push(hasWord ? session : `Session ${session}`);
              }
              return (
                <div className="flex items-center gap-2 text-sm sm:text-base font-semibold text-foreground dark:text-gray-100">
                  <span className="truncate">{parts.join(' / ')}</span>
                  {groupPinned && <Pin className="h-4 w-4 text-pink-500" />}
                  {groupHidden && <EyeOff className="h-4 w-4 text-red-500" />}
                  {isCaseComplete && showResults && (
                    <span className="flex items-center gap-1">
                      {answerResult === true && <CheckCircle className="h-4 w-4 text-green-600" />}
                      {answerResult === 'partial' && <AlertCircle className="h-4 w-4 text-yellow-600" />}
                      {answerResult === false && <AlertCircle className="h-4 w-4 text-red-600" />}
                    </span>
                  )}
                  <span className="ml-auto inline-flex gap-1">
                    <Button variant="outline" size="sm" onClick={toggleGroupPin} className="flex items-center gap-1">
                      {groupPinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
                      <span className="hidden sm:inline">{groupPinned ? 'Unpin' : 'Pin'}</span>
                    </Button>
                    {(user?.role === 'admin' || user?.role === 'maintainer') && (
                      <Button variant="outline" size="sm" onClick={toggleGroupHidden} disabled={isTogglingHidden} title={groupHidden ? 'Unhide' : 'Hide'}>
                        {groupHidden ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                      </Button>
                    )}
                    {(user?.role === 'admin' || user?.role === 'maintainer') && (
                      <Button variant="outline" size="sm" title="Éditer le cas clinique" onClick={() => setOpenCaseEdit(true)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {/* Report whole clinical case (reports first question id for context) */}
                    <Button
                      variant="outline"
                      size="sm"
                      title="Signaler"
                      onClick={() => {
                        const first = clinicalCase.questions[0];
                        if (first) {
                          setReportTargetQuestion(first);
                          setIsReportDialogOpen(true);
                        }
                      }}
                      className="flex items-center gap-1"
                    >
                      <Flag className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Signaler</span>
                    </Button>
                    {user?.role === 'admin' && (
                      <Button variant="outline" size="sm" className="text-destructive" disabled={isDeleting} onClick={handleDeleteGroup} title="Delete all">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </span>
                </div>
              );
            })()}
            {(specialtyName || lectureTitle) && (
              <div className="text-xs sm:text-sm text-muted-foreground">{[specialtyName, lectureTitle].filter(Boolean).join(' • ')}</div>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-2">
          <div className="mb-4">
            <div className="flex justify-between text-sm text-muted-foreground mb-2">
              <span>{answeredQuestions} sur {clinicalCase.totalQuestions} questions répondues</span>
              <span>{Math.round(progress)}% complété</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
          <div className="flex flex-wrap gap-2 mb-4">
            {clinicalCase.questions.map((question, index) => {
              const status = getQuestionStatus(question);
              return (
                <div key={question.id} className="flex items-center gap-1 px-2 py-1 rounded text-xs">
                  {status === 'correct' && <CheckCircle className="h-3 w-3 text-green-600" />}
                  {status === 'partial' && <AlertCircle className="h-3 w-3 text-yellow-600" />}
                  {status === 'incorrect' && <AlertCircle className="h-3 w-3 text-red-600" />}
                  {status === 'answered' && <Circle className="h-3 w-3 text-blue-600" />}
                  {status === 'unanswered' && <Circle className="h-3 w-3 text-muted-foreground" />}
                  <span className={status === 'unanswered' ? 'text-muted-foreground' : ''}>{index + 1}</span>
                </div>
              );
            })}
          </div>
          {clinicalCase.caseText && (
            <div className="py-6 border-t border-border">
              <div className="text-lg sm:text-xl leading-relaxed whitespace-pre-wrap text-foreground font-medium">
                <HighlightableCaseText lectureId={lectureId} text={clinicalCase.caseText} className="break-words" />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <div className="space-y-6 mt-6">
            {clinicalCase.questions.map((question, index) => renderQuestion(question, index))}
          </div>
          <div className="mt-8 space-y-4">
            
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 flex-wrap">
              {/* Progress / status */}
              <div className="text-sm text-muted-foreground">
                {showResults
                  ? 'Résultats affichés - Continuer'
                  : answeredQuestions === clinicalCase.totalQuestions
                    ? 'Toutes les questions répondues - Soumettre la réponse'
                    : `${clinicalCase.totalQuestions - answeredQuestions} question(s) restante(s)`}
              </div>

              <div className="flex gap-2 flex-wrap justify-end items-center">
                {/* Always show submit (disabled until all answered or already submitted) */}
                {!showResults && (
                  <Button
                    onClick={handleCompleteCase}
                    size="sm"
                    disabled={answeredQuestions !== clinicalCase.totalQuestions || isCaseComplete}
                    className={`font-semibold ${answeredQuestions === clinicalCase.totalQuestions && !isCaseComplete ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-blue-600/50 text-white cursor-not-allowed'}`}
                  >
                    Soumettre la réponse
                  </Button>
                )}

                {/* Notes + reset + next buttons after results */}
                {isCaseComplete && showResults && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setShowNotesArea(p => !p);
                        if (!showNotesArea) setTimeout(() => { document.getElementById(`clinical-case-notes-${clinicalCase.caseNumber}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 30);
                      }}
                      className="flex items-center gap-1"
                    >
                      <StickyNote className="h-4 w-4" />
                      <span className="hidden sm:inline">{showNotesArea ? 'Fermer les notes' : (notesHasContent ? 'Mes notes' : 'Prendre une note')}</span>
                    </Button>

                    <Button onClick={onNext} size="sm" className="bg-blue-600 hover:bg-blue-700 text-white font-semibold">
                      Suivant
                      <ChevronRight className="h-4 w-4 ml-2" />
                    </Button>
                  </>
                )}
              </div>
            </div>
            <div id={`clinical-case-notes-${clinicalCase.caseNumber}`} className="space-y-6">
              {(showNotesArea || notesHasContent) && (
                <QuestionNotes 
                  questionId={`clinical-case-${clinicalCase.caseNumber}`} 
                  onHasContentChange={setNotesHasContent}
                  autoEdit={showNotesArea && !notesHasContent} // Auto-edit when manually opened and empty
                />
              )}
              {isCaseComplete && (
                <QuestionComments questionId={`clinical-case-${clinicalCase.caseNumber}`} />
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={showCaseDialog} onOpenChange={setShowCaseDialog}>
        <DialogTrigger asChild>
          <Button variant="default" size="sm" className="fixed bottom-6 left-6 h-12 w-12 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 z-50 bg-blue-600 hover:bg-blue-700" aria-label="Voir le texte du cas clinique">
            <FileText className="h-5 w-5" />
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />Cas Clinique {clinicalCase.caseNumber}
            </DialogTitle>
          </DialogHeader>
          <div className="mt-4 prose max-w-none text-sm leading-relaxed whitespace-pre-wrap text-foreground">
            <HighlightableCaseText lectureId={lectureId} text={clinicalCase.caseText} />
          </div>
        </DialogContent>
      </Dialog>
      {openCaseEdit && (
        <ClinicalCaseEditDialog caseNumber={clinicalCase.caseNumber} questions={clinicalCase.questions} isOpen={openCaseEdit} onOpenChange={setOpenCaseEdit} onSaved={() => { try { window.location.reload(); } catch {} }} />
      )}
      {reportTargetQuestion && (
        <ReportQuestionDialog
          question={reportTargetQuestion}
          lectureId={lectureId}
          isOpen={isReportDialogOpen}
          onOpenChange={(open) => setIsReportDialogOpen(open)}
        />
      )}
    </div>
  );
}