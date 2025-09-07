'use client'

import { useParams, useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { useLecture } from '@/hooks/use-lecture'
import { useAuth } from '@/contexts/AuthContext'
import { UniversalHeader } from '@/components/layout/UniversalHeader'
import { AppSidebar, AppSidebarProvider } from '@/components/layout/AppSidebar'
import { SidebarInset } from '@/components/ui/sidebar'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  ChevronLeft,
  CheckCircle,
  XCircle,
  AlertCircle,
  BookOpen,
  Eye,
  EyeOff
} from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { Question } from '@/types'

export default function LectureRevisionPage() {
  const params = useParams()
  const router = useRouter()
  const { user } = useAuth()
  const [questions, setQuestions] = useState<Question[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showAnswers, setShowAnswers] = useState<Record<string, boolean>>({})
  
  const lectureId = params?.lectureId as string
  const specialtyId = params?.specialtyId as string
  const { lecture } = useLecture(lectureId)

  if (!lectureId) {
    return <div>Lecture ID not found</div>
  }

  // Override back navigation to use nested route
  const handleBack = () => {
    if (specialtyId) {
      router.push(`/exercices/${specialtyId}`)
    } else {
      router.push('/exercices')
    }
  }

  // Load questions for this lecture
  useEffect(() => {
    const loadQuestions = async () => {
      if (!lectureId) return
      
      try {
        setIsLoading(true)
        const response = await fetch(`/api/questions?lectureId=${lectureId}`)
        if (response.ok) {
          const questionsData = await response.json()
          setQuestions(questionsData)
        } else {
          console.error('Failed to load questions')
          toast({
            title: "Error",
            description: "Failed to load questions",
            variant: "destructive",
          })
        }
      } catch (error) {
        console.error('Error loading questions:', error)
        toast({
          title: "Error",
          description: "Failed to load questions",
          variant: "destructive",
        })
      } finally {
        setIsLoading(false)
      }
    }

    loadQuestions()
  }, [lectureId])

  const toggleAnswer = (questionId: string) => {
    setShowAnswers(prev => ({
      ...prev,
      [questionId]: !prev[questionId]
    }))
  }

  const toggleAllAnswers = () => {
    const allShown = questions.every(q => showAnswers[q.id])
    const newState = questions.reduce((acc, q) => {
      acc[q.id] = !allShown
      return acc
    }, {} as Record<string, boolean>)
    setShowAnswers(newState)
  }

  const getAnswerIcon = (question: Question) => {
    if (question.type === 'mcq' && question.options?.length === 2) {
      // For true/false style MCQ questions
      return question.correct_answers?.[0] === 'true' ? (
        <CheckCircle className="w-5 h-5 text-green-600" />
      ) : (
        <XCircle className="w-5 h-5 text-red-600" />
      )
    }
    return <AlertCircle className="w-5 h-5 text-blue-600" />
  }

  const getDifficultyColor = (difficulty?: string) => {
    switch (difficulty?.toLowerCase()) {
      case 'easy': return 'bg-green-100 text-green-800'
      case 'medium': return 'bg-yellow-100 text-yellow-800'
      case 'hard': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  if (isLoading) {
    return (
      <ProtectedRoute>
        <AppSidebarProvider>
          <AppSidebar />
          <SidebarInset className="flex-1 flex flex-col">
            <UniversalHeader title="Loading..." />
            <div className="flex-1 bg-gray-50 dark:bg-gray-900 p-8">
              <div className="animate-pulse space-y-6">
                <div className="bg-white dark:bg-gray-800 rounded-xl p-6">
                  <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-4"></div>
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-xl p-6">
                  <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-3"></div>
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full mb-2"></div>
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3"></div>
                </div>
              </div>
            </div>
          </SidebarInset>
        </AppSidebarProvider>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
      <AppSidebarProvider>
        <AppSidebar />
        <SidebarInset className="flex-1 flex flex-col">
          <UniversalHeader title={`Revision - ${lecture?.title || 'Lecture'}`} />
          
          <div className="flex-1 bg-gray-50 dark:bg-gray-900">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
              
              {/* Breadcrumb Navigation */}
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => router.push('/exercices')}
                  className="flex items-center gap-1 px-2 py-1 h-auto hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  Exercises
                </Button>
                <span>/</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleBack}
                  className="flex items-center gap-1 px-2 py-1 h-auto hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  Specialty
                </Button>
                <span>/</span>
                <span className="text-gray-900 dark:text-gray-100 font-medium">Revision</span>
              </div>
              
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Button
                    variant="ghost"
                    onClick={handleBack}
                    className="flex items-center gap-2"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Back to Specialty
                  </Button>
                  <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                      Revision Mode
                    </h1>
                    <p className="text-gray-600 dark:text-gray-400">
                      Review questions with answers - {questions.length} questions
                    </p>
                  </div>
                </div>
                
                <Button
                  onClick={toggleAllAnswers}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {questions.every(q => showAnswers[q.id]) ? (
                    <>
                      <EyeOff className="w-4 h-4 mr-2" />
                      Hide All
                    </>
                  ) : (
                    <>
                      <Eye className="w-4 h-4 mr-2" />
                      Show All
                    </>
                  )}
                </Button>
              </div>

          {/* Questions List */}
          {questions.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center">
              <div className="bg-blue-100 dark:bg-blue-900/30 rounded-full p-4 w-16 h-16 mx-auto mb-6">
                <BookOpen className="w-8 h-8 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-3">
                No Questions Available
              </h3>
              <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto">
                This lecture doesn&apos;t have any questions yet. Check back later for content updates.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {questions.map((question, index) => (
                <div key={question.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                  {/* Question Header */}
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="bg-blue-600 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold">
                          {index + 1}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="secondary" className="text-xs">
                              {question.type.replace('_', ' ').toUpperCase()}
                            </Badge>
                            {question.number && (
                              <Badge className="text-xs bg-gray-100 text-gray-700">
                                Q{question.number}
                              </Badge>
                            )}
                          </div>
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                            {question.text}
                          </h3>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleAnswer(question.id)}
                        className="shrink-0"
                      >
                        {showAnswers[question.id] ? (
                          <>
                            <EyeOff className="w-4 h-4 mr-2" />
                            Hide Answer
                          </>
                        ) : (
                          <>
                            <Eye className="w-4 h-4 mr-2" />
                            Show Answer
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                  
                  <div className="p-6">
                    {/* Multiple Choice Options */}
                    {question.type === 'mcq' && question.options && question.options.length !== 2 && (
                      <div className="space-y-3 mb-6">
                        {question.options.map((option, optionIndex) => {
                          const isCorrect = question.correct_answers?.includes(option.id)
                          return (
                            <div
                              key={optionIndex}
                              className={`relative p-4 rounded-lg border-2 transition-all duration-200 ${
                                showAnswers[question.id] && isCorrect
                                  ? 'bg-green-50 border-green-300 dark:bg-green-900/20 dark:border-green-600'
                                  : 'bg-gray-50 border-gray-200 dark:bg-gray-700/50 dark:border-gray-600 hover:border-blue-200 dark:hover:border-blue-700'
                              }`}
                            >
                              <div className="flex items-center gap-4">
                                <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-sm font-bold ${
                                  showAnswers[question.id] && isCorrect
                                    ? 'bg-green-600 border-green-600 text-white'
                                    : 'bg-white border-gray-300 text-gray-600 dark:bg-gray-600 dark:border-gray-500 dark:text-gray-200'
                                }`}>
                                  {String.fromCharCode(65 + optionIndex)}
                                </div>
                                <span className="flex-1 text-gray-900 dark:text-gray-100">
                                  {option.text}
                                </span>
                                {showAnswers[question.id] && isCorrect && (
                                  <CheckCircle className="w-6 h-6 text-green-600" />
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}

                    {/* True/False style MCQ (2 options) */}
                    {question.type === 'mcq' && question.options && question.options.length === 2 && (
                      <div className="space-y-3 mb-6">
                        {question.options.map((option, optionIndex) => {
                          const isCorrect = question.correct_answers?.includes(option.id)
                          const label = option.text?.toLowerCase().startsWith('t')
                            ? 'T'
                            : option.text?.toLowerCase().startsWith('f')
                              ? 'F'
                              : String.fromCharCode(65 + optionIndex)
                          return (
                            <div
                              key={option.id}
                              className={`relative p-4 rounded-lg border-2 transition-all duration-200 ${
                                showAnswers[question.id] && isCorrect
                                  ? 'bg-green-50 border-green-300 dark:bg-green-900/20 dark:border-green-600'
                                  : 'bg-gray-50 border-gray-200 dark:bg-gray-700/50 dark:border-gray-600'
                              }`}
                            >
                              <div className="flex items-center gap-4">
                                <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-sm font-bold ${
                                  showAnswers[question.id] && isCorrect
                                    ? 'bg-green-600 border-green-600 text-white'
                                    : 'bg-white border-gray-300 text-gray-600 dark:bg-gray-600 dark:border-gray-500 dark:text-gray-200'
                                }`}>
                                  {label}
                                </div>
                                <span className="flex-1 text-gray-900 dark:text-gray-100">
                                  {option.text}
                                </span>
                                {showAnswers[question.id] && isCorrect && (
                                  <CheckCircle className="w-6 h-6 text-green-600" />
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}

                    {/* Answer and Explanation */}
                    {showAnswers[question.id] && (
                      <div className="bg-gradient-to-r from-emerald-50 to-green-50 dark:from-emerald-900/20 dark:to-green-900/20 rounded-lg border border-emerald-200 dark:border-emerald-800 p-6">
                        <div className="flex items-start gap-4">
                          <div className="bg-emerald-600 rounded-full p-2 shrink-0">
                            {getAnswerIcon(question)}
                          </div>
                          <div className="flex-1">
                            <h4 className="font-semibold text-emerald-900 dark:text-emerald-100 mb-3 text-lg">
                              Correct Answer
                            </h4>
                            <div className="bg-white dark:bg-gray-700 rounded-lg p-4 mb-4 border border-emerald-100 dark:border-emerald-800">
                              <p className="text-emerald-800 dark:text-emerald-200 font-medium">
                                {question.options?.filter(opt => question.correct_answers?.includes(opt.id)).map(opt => opt.text).join(', ') || 'N/A'}
                              </p>
                            </div>
                            {question.explanation && (
                              <>
                                <h5 className="font-semibold text-emerald-900 dark:text-emerald-100 mb-2">
                                  Explanation
                                </h5>
                                <p className="text-emerald-700 dark:text-emerald-300 leading-relaxed">
                                  {question.explanation}
                                </p>
                              </>
                            )}
                            {question.course_reminder && (
                              <>
                                <h5 className="font-semibold text-emerald-900 dark:text-emerald-100 mb-2 mt-4">
                                  Course Reminder
                                </h5>
                                <p className="text-emerald-700 dark:text-emerald-300 leading-relaxed">
                                  {question.course_reminder}
                                </p>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </SidebarInset>
  </AppSidebarProvider>
</ProtectedRoute>
)
}
