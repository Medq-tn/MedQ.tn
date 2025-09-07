'use client'

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft,
  FileText,
  Loader2,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Maximize2,
  Minimize2,
  FileCheck2,
  PanelRightOpen,
  PanelRightClose,
  CheckCircle
} from 'lucide-react';
// Lazy client-only react-pdf imports to avoid SSR DOMMatrix errors
import dynamic from 'next/dynamic';
const PDFDoc = dynamic(() => import('react-pdf').then(m => m.Document), { ssr: false });
const PDFPage = dynamic(() => import('react-pdf').then(m => m.Page), { ssr: false });
import { useAuth } from '@/contexts/AuthContext';
import { PDFProvider } from '@/components/pdf/PDFProvider';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { UniversalHeader } from '@/components/layout/UniversalHeader';
import { AppSidebar, AppSidebarProvider } from '@/components/layout/AppSidebar';
import { SidebarInset, useSidebar } from '@/components/ui/sidebar';
import { CorrectionZone } from '@/components/session/CorrectionZone';

// Import CSS for react-pdf
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

type Session = {
  id: string;
  name: string;
  pdfUrl?: string;
  correctionUrl?: string;
  specialty: {
    id: string;
    name: string;
  };
  niveau?: {
    name: string;
  };
  semester?: {
    name: string;
    order: number;
  };
};

// Helper to sanitize / normalize PDF links (Google Drive share -> direct download)
function getValidPdfLink(dbLink?: string | null): string | undefined {
  if (!dbLink) return undefined;
  // Already looks like a direct PDF
  if (/\.pdf($|[?#])/i.test(dbLink)) return dbLink;
  // Google Drive patterns
  const driveRegex = /https?:\/\/drive\.google\.com\/(?:file\/d\/|open\?id=)([a-zA-Z0-9_-]+)/i;
  const match = dbLink.match(driveRegex);
  if (match) {
    const id = match[1];
  return `https://drive.google.com/uc?export=download&id=${id}`; // will be proxied client-side
  }
  // If already a uc?export form keep it
  if (/https?:\/\/drive\.google\.com\/uc\?export=download&id=/i.test(dbLink)) return dbLink;
  return dbLink; // fallback unchanged
}

// Removed floating correction button / modal; correction now displayed inline beside exam.

export default function SessionViewerPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();

  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadingPdf, setLoadingPdf] = useState(true);
  const [numPages, setNumPages] = useState<number | null>(null);
  const [scale, setScale] = useState(1.2);
  // Exam PDF state
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [pdfError, setPdfError] = useState<string | null>(null);

  // Removed page/scroll toggle: always scrolling all pages
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const [showCorrectionPdf, setShowCorrectionPdf] = useState(false); // replaces zone when true

  // Correction PDF state (separate page/zoom/rotation)
  const [correctionNumPages, setCorrectionNumPages] = useState<number | null>(null);
  const [correctionScale, setCorrectionScale] = useState(1.0);
  const [correctionRotation, setCorrectionRotation] = useState(0);
  const [correctionLoading, setCorrectionLoading] = useState(true);
  const [correctionError, setCorrectionError] = useState<string | null>(null);
  // Refs for auto-fit sizing
  const examViewerRef = useRef<HTMLDivElement | null>(null);
  const correctionViewerRef = useRef<HTMLDivElement | null>(null);

  // Auto-fit helpers (approx A4 size at 72dpi: 595x842)
  const fitExamPage = useCallback(() => {
    const el = examViewerRef.current;
    if (!el) return;
    const baseW = (rotation % 180 === 90) ? 842 : 595;
    const availW = el.clientWidth - 32; // padding margin allowance
    if (availW <= 0) return;
    const scaleW = availW / baseW;
    const newScale = Math.max(0.4, Math.min(3, scaleW));
    setScale(newScale);
  }, [rotation]);

  const fitCorrectionPage = useCallback(() => {
    const el = correctionViewerRef.current;
    if (!el) return;
    const baseW = (correctionRotation % 180 === 90) ? 842 : 595;
    const availW = el.clientWidth - 32;
    if (availW <= 0) return;
    const scaleW = availW / baseW;
    const newScale = Math.max(0.4, Math.min(3, scaleW));
    setCorrectionScale(newScale);
  }, [correctionRotation]);

  const viewType = searchParams.get('type') || 'exam';
  // Allow all authenticated roles (including students) to view correction PDF
  const canViewCorrection = !!user; // previously restricted to admin/maintainer
  const mode: 'admin' | 'maintainer' | 'student' = user?.role === 'admin' ? 'admin' : user?.role === 'maintainer' ? 'maintainer' : 'student';

  // Normalize params
  const sessionId = Array.isArray(params.sessionId) ? params.sessionId[0] : params.sessionId;
  const specialtyId = Array.isArray(params.id) ? params.id[0] : params.id;
  
  // Sanitize exam and correction URLs independently
  const examUrlRaw = session?.pdfUrl ? getValidPdfLink(session.pdfUrl) : undefined;
  const correctionUrlRaw = session?.correctionUrl ? getValidPdfLink(session.correctionUrl) : undefined;
  const examUrl = examUrlRaw ? (/drive\.google\.com/.test(examUrlRaw) ? `/api/proxy-pdf?url=${encodeURIComponent(examUrlRaw)}` : examUrlRaw) : undefined;
  const correctionUrl = correctionUrlRaw ? (/drive\.google\.com/.test(correctionUrlRaw) ? `/api/proxy-pdf?url=${encodeURIComponent(correctionUrlRaw)}` : correctionUrlRaw) : undefined;
  const currentPdfUrl = examUrl; // always exam in main view
  const canShowCorrection = !!(session && canViewCorrection && correctionUrlRaw);
  // auto open PDF view (in-panel) if ?type=correction
  useEffect(() => { if (viewType === 'correction' && canShowCorrection) { setPanelCollapsed(false); setShowCorrectionPdf(true); } }, [viewType, canShowCorrection]);

  // Fetch session data
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!sessionId) return;
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/sessions/${sessionId}`, { cache: 'no-store' });
        if (!res.ok) {
          if (res.status === 404) {
            if (!cancelled) {
              setSession(null);
              setError('Session introuvable');
            }
          } else {
            const txt = await res.text().catch(() => '');
            console.warn('Fetch session error', res.status, txt);
            if (!cancelled) setError('Erreur lors du chargement de la session');
          }
        } else {
          const data = await res.json();
          if (!cancelled) {
            setSession(data);
          }
        }
      } catch (e) {
        console.error('Network error session fetch', e);
        if (!cancelled) setError('Erreur réseau');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [sessionId, viewType]);

  // PDF handlers
  const onDocumentLoadSuccess = useCallback(({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setLoadingPdf(false);
    setPdfError(null);
  }, []);

  const onDocumentLoadError = useCallback((err: Error) => {
    console.error('PDF load error', err);
    setLoadingPdf(false);
    // Normalize common pdf.js error types
    if ((err as any)?.name === 'MissingPDFException') {
      setPdfError('Document PDF introuvable.');
    } else if ((err as any)?.name === 'InvalidPDFException') {
      setPdfError('Fichier PDF invalide ou corrompu.');
    } else if ((err as any)?.name === 'UnexpectedResponseException') {
      setPdfError('Réponse inattendue lors du chargement du PDF.');
    } else {
      setPdfError('Erreur lors du chargement du PDF.');
    }
  }, []);

  const changeScale = (delta: number) => {
    setScale(prev => Math.max(0.5, Math.min(prev + delta, 3)));
  };

  const toggleFullscreen = () => {
    try {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen?.();
        setIsFullscreen(true);
      } else {
        document.exitFullscreen?.();
        setIsFullscreen(false);
      }
    } catch (e) {
      console.error('Fullscreen error', e);
    }
  };

  // Pre-validate PDF via HEAD (or GET fallback) when URL changes to surface errors early.
  useEffect(() => {
    if (!currentPdfUrl) return;
    let cancelled = false;
    setPdfError(null);
    setLoadingPdf(true);
    const controller = new AbortController();
    const validate = async () => {
      try {
        // Skip preflight for proxied (local) URL; proxy enforces type
        if (!currentPdfUrl.startsWith('/api/proxy-pdf')) {
          let res = await fetch(currentPdfUrl, { method: 'HEAD', signal: controller.signal });
          if (!res.ok) {
            if (!cancelled) setPdfError(`Impossible de charger le PDF (HTTP ${res.status}).`);
            return;
          }
          const ct = res.headers.get('content-type') || '';
          if (!ct.includes('pdf')) {
            if (!cancelled) setPdfError('Le lien ne pointe pas vers un PDF.');
            return;
          }
        }
      } catch (e: any) {
        if (e?.name === 'AbortError') return;
        console.error('PDF HEAD validation error', e);
        if (!cancelled) setPdfError('Erreur réseau lors de la vérification du PDF.');
      }
    };
    validate();
    return () => { cancelled = true; controller.abort(); };
  }, [currentPdfUrl]);

  // Re-fit on window resize / layout changes
  useEffect(() => {
    const handle = () => { fitExamPage(); fitCorrectionPage(); };
    window.addEventListener('resize', handle);
    return () => window.removeEventListener('resize', handle);
  }, [fitExamPage, fitCorrectionPage]);

  // Re-fit when page count or panel collapse changes
  useEffect(() => { fitExamPage(); }, [numPages, panelCollapsed, rotation, fitExamPage]);
  useEffect(() => { if (showCorrectionPdf) fitCorrectionPage(); }, [showCorrectionPdf, correctionNumPages, correctionRotation, panelCollapsed, fitCorrectionPage]);

  return (
    <ProtectedRoute>
      <AppSidebarProvider>
        <SidebarOpenConsumer>
          {(sidebarOpen) => (
            <PDFProvider>
              <div className="flex min-h-screen w-full">
            <AppSidebar />
            <SidebarInset className="flex-1 flex flex-col bg-gray-50 dark:bg-gray-900">
              <UniversalHeader
                title={session ? session.name : loading ? 'Chargement…' : (error || 'Session')}
                hideSeparator
                leftActions={(
                  <Button 
                    variant="outline" 
                    size="default" 
                    onClick={() => router.push(specialtyId ? `/session/${specialtyId}` : '/session')} 
                    className="group gap-2 bg-card/80 border-border hover:bg-accent hover:border-accent-foreground/20 transition-all duration-200 shadow-sm hover:shadow-md backdrop-blur-sm"
                  >
                    <ArrowLeft className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform duration-200" /> 
                    <span className="font-medium">Retour</span>
                  </Button>
                )}
                actions={(
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="hidden md:flex items-center gap-2">
                      {session && session.semester && <Badge variant="outline" className="text-xs">S{session.semester.order}</Badge>}
                    </div>
                  </div>
                )}
              />
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 relative">
                {loading ? (
                  <div className="flex items-center justify-center min-h-[50vh]">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                  </div>
                ) : !session ? (
                  <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
                    <FileText className="h-12 w-12 text-muted-foreground" />
                    <h2 className="text-xl font-semibold">{error || 'Session non trouvée'}</h2>
                    <div className="flex gap-2">
                      <Button 
                        onClick={() => router.push(specialtyId ? `/session/${specialtyId}` : '/session')} 
                        size="default"
                        className="group gap-2 bg-primary hover:bg-primary/90 text-primary-foreground shadow-md hover:shadow-lg transition-all duration-200"
                      >
                        <ArrowLeft className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform duration-200" /> 
                        <span className="font-medium">Retour</span>
                      </Button>
                      {sessionId && (
                        <Button variant="outline" size="default" onClick={() => router.refresh()} className="bg-card/80 border-border hover:bg-accent hover:border-accent-foreground/20 transition-all duration-200">
                          Réessayer
                        </Button>
                      )}
                    </div>
                  </div>
                ) : !currentPdfUrl ? (
                  <Card>
                    <CardContent className="flex flex-col items-center justify-center py-12">
                      <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                      <h3 className="text-lg font-medium mb-2">Document non disponible</h3>
                      <p className="text-muted-foreground text-center mb-4">
                        {"Le document de cet examen n'est pas disponible."}
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="w-full mx-auto max-w-[1600px] grid gap-6 xl:grid-cols-12 items-start">
                    {/* Exam PDF Viewer (responsive to sidebar) */}
                    <div
                      className={`min-w-0 space-y-4 transition-all duration-300 xl:col-span-12
                        ${!panelCollapsed ? 'xl:col-span-6 2xl:col-span-7' : 'xl:col-span-12'}
                      `}
                    >
                      <Card className="border-border/50 bg-white/50 dark:bg-muted/30 backdrop-blur-sm shadow-lg">
                        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-blue-400/40 via-blue-600/10 to-blue-400/40" />
                        <CardContent className="p-3 sm:p-4">
                          <div className="flex flex-col gap-3 text-xs sm:text-sm">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant="default" className="bg-blue-600 text-white text-xs">Examen</Badge>
                              {numPages && <span className="text-sm text-blue-800 dark:text-blue-200 font-medium whitespace-nowrap">{numPages} pages</span>}
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setPanelCollapsed(c => !c)}
                                  className="ml-auto bg-white/70 dark:bg-muted/40 hover:bg-blue-50 dark:hover:bg-blue-900/30 border-blue-200 dark:border-blue-800 gap-1"
                                >
                                  {panelCollapsed ? <PanelRightOpen className="h-4 w-4" /> : <PanelRightClose className="h-4 w-4" />}
                                  <span className="hidden sm:inline">{panelCollapsed ? 'Afficher correction' : 'Masquer correction'}</span>
                                </Button>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <Button variant="outline" size="sm" onClick={() => changeScale(-0.2)} disabled={scale <= 0.5}
                                className="bg-white/70 dark:bg-muted/40 hover:bg-blue-50 dark:hover:bg-blue-900/30 border-blue-200 dark:border-blue-800 p-2">
                                <ZoomOut className="h-4 w-4" />
                              </Button>
                              <span className="text-xs text-blue-800 dark:text-blue-200 font-medium min-w-[50px] text-center">{Math.round(scale * 100)}%</span>
                              <Button variant="outline" size="sm" onClick={() => changeScale(0.2)} disabled={scale >= 3}
                                className="bg-white/70 dark:bg-muted/40 hover:bg-blue-50 dark:hover:bg-blue-900/30 border-blue-200 dark:border-blue-800 p-2">
                                <ZoomIn className="h-4 w-4" />
                              </Button>
                              <Button variant="outline" size="sm" onClick={fitExamPage}
                                className="bg-white/70 dark:bg-muted/40 hover:bg-blue-50 dark:hover:bg-blue-900/30 border-blue-200 dark:border-blue-800 px-2 text-[11px]">Ajuster</Button>
                              <Button variant="outline" size="sm" onClick={() => setRotation(prev => (prev + 90) % 360)}
                                className="bg-white/70 dark:bg-muted/40 hover:bg-blue-50 dark:hover:bg-blue-900/30 border-blue-200 dark:border-blue-800 p-2">
                                <RotateCw className="h-4 w-4" />
                              </Button>
                              <Button variant="outline" size="sm" onClick={toggleFullscreen}
                                className="hidden sm:flex bg-white/70 dark:bg-muted/40 hover:bg-blue-50 dark:hover:bg-blue-900/30 border-blue-200 dark:border-blue-800 p-2">
                                {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
            <Card className="border-border/50 bg-white/50 dark:bg-muted/30 backdrop-blur-sm shadow-lg overflow-hidden">
                        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-blue-400/40 via-blue-600/10 to-blue-400/40" />
                        <CardContent className="p-0">
                          <div className="flex justify-center bg-gradient-to-br from-blue-50/80 via-white to-indigo-50/40 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 h-[calc(100vh-60px)] max-h-[calc(100vh-60px)] relative rounded-md overflow-hidden">
                            {pdfError ? (
                              <div className="flex flex-col items-center justify-center text-center p-8 gap-3 max-w-md">
                                <div className="w-16 h-16 rounded-xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center mb-2">
                                  <FileText className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                                </div>
                                <p className="font-medium text-blue-800 dark:text-blue-200">{pdfError}</p>
                                <div className="flex gap-2">
                                  <Button size="sm" onClick={() => setRotation(r => (r + 90) % 360)} variant="outline"
                                    className="bg-white/70 dark:bg-muted/40 hover:bg-blue-50 dark:hover:bg-blue-900/30 border-blue-200 dark:border-blue-800">
                                    Tourner
                                  </Button>
                                  <Button size="sm" variant="outline" onClick={() => window.open(currentPdfUrl, '_blank')}
                                    className="bg-white/70 dark:bg-muted/40 hover:bg-blue-50 dark:hover:bg-blue-900/30 border-blue-200 dark:border-blue-800">
                                    Ouvrir dans un onglet
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <>
                                {loadingPdf && (
                                  <div className="absolute inset-0 flex items-center justify-center backdrop-blur-sm bg-white/20 dark:bg-slate-900/20">
                                    <div className="flex items-center gap-3 bg-white/80 dark:bg-slate-800/80 px-4 py-3 rounded-xl shadow-lg">
                                      <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                                      <span className="text-blue-800 dark:text-blue-200 font-medium">Chargement du PDF...</span>
                                    </div>
                                  </div>
                                )}
                                <div ref={examViewerRef} className="w-full h-full overflow-auto px-4 py-6 custom-scroll-thin">
                                  <PDFDoc
                                    file={currentPdfUrl}
                                    onLoadSuccess={onDocumentLoadSuccess}
                                    onLoadError={onDocumentLoadError}
                                    loading=""
                                    className="flex flex-col items-center"
                                  >
                                    {numPages ? Array.from({ length: numPages }, (_, i) => (
                                      <div key={i} className="mb-6 last:mb-0">
                                        <PDFPage
                                          pageNumber={i + 1}
                                          scale={scale}
                                          rotate={rotation}
                                          className="shadow-xl bg-white rounded-lg border-2 border-blue-100 dark:border-blue-800"
                                          renderTextLayer={false}
                                          renderAnnotationLayer={false}
                                        />
                                      </div>
                                    )) : (
                                      <PDFPage
                                        pageNumber={1}
                                        scale={scale}
                                        rotate={rotation}
                                        className="shadow-xl bg-white rounded-lg border-2 border-blue-100 dark:border-blue-800"
                                        renderTextLayer={false}
                                        renderAnnotationLayer={false}
                                      />
                                    )}
                                  </PDFDoc>
                                </div>
                              </>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                    {/* Correction Panel (collapsible) shows only editable zone */}
                    {session && !panelCollapsed && (
                      <div
                        className={`min-w-0 space-y-4 transition-all duration-300 xl:col-span-6 2xl:col-span-5`}
                      >
                        <Card className="border-border/50 bg-white/50 dark:bg-muted/30 backdrop-blur-sm shadow-lg">
                          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-blue-400/40 via-blue-600/10 to-blue-400/40" />
                          <CardContent className="p-3 sm:p-4">
                            <div className="flex items-center gap-2 mb-3">
                              <CheckCircle className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                              <span className="text-sm font-medium text-blue-800 dark:text-blue-200">Zone de Correction</span>
                              {/* Removed open PDF button; use floating button instead */}
                              {canShowCorrection && showCorrectionPdf && (
                                <Button size="sm" variant="outline" onClick={() => setShowCorrectionPdf(false)} className="ml-auto gap-2 bg-white/70 dark:bg-muted/40 hover:bg-blue-50 dark:hover:bg-blue-900/30 border-blue-200 dark:border-blue-800">
                                  Fermer PDF
                                </Button>
                              )}
                            </div>
                            {!showCorrectionPdf && (
                              <div className="max-h-[calc(100vh-70px)] overflow-y-auto pr-1 custom-scroll-thin">
                                <CorrectionZone sessionId={session.id} mode={mode} />
                              </div>
                            )}
                            {showCorrectionPdf && canShowCorrection && correctionUrl && (
                              <div className="flex flex-col border border-blue-100 dark:border-blue-800 rounded-lg overflow-hidden bg-gradient-to-br from-blue-50/60 via-white to-indigo-50/40 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
                                <div className="flex items-center gap-2 px-3 py-2 border-b border-blue-200 dark:border-blue-800 bg-white/70 dark:bg-muted/40 text-xs flex-wrap">
                                  {correctionNumPages && <span className="text-blue-800 dark:text-blue-200 font-medium text-[11px]">{correctionNumPages} pages</span>}
                                  <Button variant="outline" size="sm" onClick={() => setCorrectionScale(s => Math.max(0.5, s - 0.2))} disabled={correctionScale <= 0.5}
                                    className="p-2 bg-white/70 dark:bg-muted/40 hover:bg-blue-50 dark:hover:bg-blue-900/30 border-blue-200 dark:border-blue-800"><ZoomOut className="h-3 w-3" /></Button>
                                  <span className="text-[11px] w-10 text-center text-blue-800 dark:text-blue-200 font-medium">{Math.round(correctionScale * 100)}%</span>
                                  <Button variant="outline" size="sm" onClick={() => setCorrectionScale(s => Math.min(3, s + 0.2))} disabled={correctionScale >= 3}
                                    className="p-2 bg-white/70 dark:bg-muted/40 hover:bg-blue-50 dark:hover:bg-blue-900/30 border-blue-200 dark:border-blue-800"><ZoomIn className="h-3 w-3" /></Button>
                                  <Button variant="outline" size="sm" onClick={() => setCorrectionRotation(r => (r + 90) % 360)}
                                    className="p-2 bg-white/70 dark:bg-muted/40 hover:bg-blue-50 dark:hover:bg-blue-900/30 border-blue-200 dark:border-blue-800"><RotateCw className="h-3 w-3" /></Button>
                                  <Button variant="outline" size="sm" onClick={fitCorrectionPage}
                                    className="px-2 text-[11px] bg-white/70 dark:bg-muted/40 hover:bg-blue-50 dark:hover:bg-blue-900/30 border-blue-200 dark:border-blue-800">Ajuster</Button>
                                </div>
                                <div ref={correctionViewerRef} className="w-full h-full max-h-[calc(100vh-80px)] overflow-auto px-4 py-4 custom-scroll-thin">
                                  <PDFDoc
                                    file={correctionUrl}
                                    onLoadSuccess={({ numPages }) => { setCorrectionNumPages(numPages); setCorrectionLoading(false); setCorrectionError(null); }}
                                    onLoadError={(err) => { console.error(err); setCorrectionLoading(false); setCorrectionError('Erreur PDF.'); }}
                                    loading=""
                                    className="flex flex-col items-center"
                                  >
                                    {correctionLoading && (
                                      <div className="flex items-center gap-2 py-4">
                                        <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                                        <span className="text-blue-800 dark:text-blue-200 text-sm">Chargement...</span>
                                      </div>
                                    )}
                                    {correctionError && (
                                      <div className="text-sm text-blue-700 dark:text-blue-300 py-6">{correctionError}</div>
                                    )}
                                    {!correctionError && (correctionNumPages ? Array.from({ length: correctionNumPages }, (_, i) => (
                                      <div key={i} className="mb-6 last:mb-0">
                                        <PDFPage
                                          pageNumber={i + 1}
                                          scale={correctionScale}
                                          rotate={correctionRotation}
                                          className="shadow-xl bg-white rounded-lg border-2 border-blue-100 dark:border-blue-800"
                                          renderTextLayer={false}
                                          renderAnnotationLayer={false}
                                        />
                                      </div>
                                    )) : (
                                      <PDFPage
                                        pageNumber={1}
                                        scale={correctionScale}
                                        rotate={correctionRotation}
                                        className="shadow-xl bg-white rounded-lg border-2 border-blue-100 dark:border-blue-800"
                                        renderTextLayer={false}
                                        renderAnnotationLayer={false}
                                      />
                                    ))}
                                  </PDFDoc>
                                </div>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      </div>
                    )}
                  </div>
                )}
                {canShowCorrection && correctionUrl && !showCorrectionPdf && <FloatingCorrectionButton onClick={() => { setPanelCollapsed(false); setShowCorrectionPdf(true); }} />}
              </div>
            </SidebarInset>
          </div>
            </PDFProvider>
          )}
        </SidebarOpenConsumer>
      </AppSidebarProvider>
    </ProtectedRoute>
  );
}

function SidebarOpenConsumer({ children }: { children: (open: boolean) => React.ReactNode }) {
  const { open } = useSidebar();
  return <>{children(open)}</>;
}

function FloatingCorrectionButton({ onClick }: { onClick: () => void }) {
  const { open } = useSidebar();
  return (
    <Button
      onClick={onClick}
      variant="default"
      className={`fixed bottom-6 shadow-xl rounded-full px-6 py-6 flex items-center gap-2 z-40 bg-blue-600 hover:bg-blue-700 text-white border-2 border-blue-200 dark:border-blue-800 transition-all duration-300 ${open ? 'left-[calc(16rem+1.5rem)]' : 'left-12'}`}
    >
      <FileCheck2 className="h-5 w-5" />
      <span className="hidden sm:inline text-sm font-medium">Correction PDF</span>
    </Button>
  );
}
