
import { useTranslation } from 'react-i18next';
import { HighlightableQuestionText } from '../HighlightableQuestionText';

interface MCQHeaderProps {
  questionText: string;
  isSubmitted: boolean;
  questionNumber?: number;
  session?: string;
  lectureTitle?: string;
  specialtyName?: string;
  questionId?: string;
  highlightConfirm?: boolean;
  hideMeta?: boolean; // when true, suppress first meta line and specialty/course line
}

export function MCQHeader({ questionText, isSubmitted, questionNumber, session, lectureTitle, specialtyName, questionId, highlightConfirm, hideMeta }: MCQHeaderProps) {
  const { t } = useTranslation();
  const sessionLabel = (() => {
    if (!session) return '';
    const hasWord = /session/i.test(session);
    return hasWord ? session : `Session ${session}`;
  })();
  const firstLineParts: string[] = [];
  firstLineParts.push('QCM');
  if (questionNumber !== undefined) firstLineParts.push(`Question ${questionNumber}`);
  if (session) firstLineParts.push(sessionLabel);
  const firstLine = firstLineParts.join(' / ');
  
  return (
    <div className="space-y-2">
      {!hideMeta && (
        <>
          <div className="text-sm sm:text-base font-semibold text-foreground dark:text-gray-100">
            {firstLine}
          </div>
          {(specialtyName || lectureTitle) && (
            <div className="text-xs sm:text-sm text-muted-foreground">
              {[specialtyName, lectureTitle].filter(Boolean).join(' • ')}
            </div>
          )}
        </>
      )}
      {questionId ? (
        <div data-question-text={questionId}>
          <HighlightableQuestionText
            questionId={questionId}
            text={questionText}
            className="mt-3 text-lg sm:text-xl font-semibold text-foreground dark:text-gray-200 break-words whitespace-pre-wrap"
            confirmMode={highlightConfirm}
          />
        </div>
      ) : (
        <h3 className="mt-3 text-lg sm:text-xl font-semibold text-foreground dark:text-gray-200 break-words whitespace-pre-wrap">{questionText}</h3>
      )}
    </div>
  );
}
