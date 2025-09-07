import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireMaintainerOrAdmin, requireAuth, AuthenticatedRequest } from '@/lib/auth-middleware';

function extractSessionId(request: Request): string | null {
  try {
    const pathname = new URL(request.url).pathname; // /api/sessions/[id]/correction
    const match = pathname.match(/\/api\/sessions\/([^/]+)\/correction/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

// GET official correction or user's submission when passing ?withSubmission=1
async function getHandler(request: AuthenticatedRequest) {
  const sessionId = extractSessionId(request);
  if (!sessionId) return NextResponse.json({ error: 'Invalid session id' }, { status: 400 });
  const url = new URL(request.url);
  const withSubmission = url.searchParams.get('withSubmission') === '1';
  try {
    const correction = await prisma.sessionCorrection.findUnique({ where: { sessionId } });
    let submission: any = null;
    if (withSubmission && request.user?.userId) {
      submission = await prisma.sessionCorrectionSubmission.findUnique({ where: { sessionId_userId: { sessionId, userId: request.user.userId } } });
    }
    return NextResponse.json({ correction, submission });
  } catch (e) {
    console.error('Fetch session correction error', e);
    return NextResponse.json({ error: 'Failed to load correction' }, { status: 500 });
  }
}

// POST create or update correction (maintainer/admin)
async function postHandler(request: AuthenticatedRequest) {
  const sessionId = extractSessionId(request);
  if (!sessionId) return NextResponse.json({ error: 'Invalid session id' }, { status: 400 });
  const body = await request.json();
  const { data } = body as { data: any };
  if (!data) return NextResponse.json({ error: 'data required' }, { status: 400 });
  try {
    const existing = await prisma.sessionCorrection.findUnique({ where: { sessionId } });
    let saved;
    if (existing) {
      saved = await prisma.sessionCorrection.update({ where: { sessionId }, data: { data } });
    } else {
      saved = await prisma.sessionCorrection.create({ data: { sessionId, data, createdBy: request.user!.userId } });
    }
    return NextResponse.json(saved);
  } catch (e) {
    console.error('Save session correction error', e);
    return NextResponse.json({ error: 'Failed to save correction' }, { status: 500 });
  }
}

// PUT user submission (student) - now stores answers only (no scoring)
async function putHandler(request: AuthenticatedRequest) {
  const sessionId = extractSessionId(request);
  if (!sessionId) return NextResponse.json({ error: 'Invalid session id' }, { status: 400 });
  const body = await request.json();
  const { answers } = body as { answers: any };
  if (!answers) return NextResponse.json({ error: 'answers required' }, { status: 400 });
  if (!request.user?.userId) return NextResponse.json({ error: 'auth required' }, { status: 401 });
  try {
    const existing = await prisma.sessionCorrectionSubmission.findUnique({ where: { sessionId_userId: { sessionId, userId: request.user.userId } } });
    let saved;
    if (existing) {
      saved = await prisma.sessionCorrectionSubmission.update({ where: { sessionId_userId: { sessionId, userId: request.user.userId } }, data: { answers, score: null } });
    } else {
      saved = await prisma.sessionCorrectionSubmission.create({ data: { sessionId, userId: request.user.userId, answers, score: null } });
    }
    return NextResponse.json({ submission: saved });
  } catch (e) {
    console.error('Save submission error', e);
    return NextResponse.json({ error: 'Failed to save submission' }, { status: 500 });
  }
}

export const GET = requireAuth(getHandler);
export const POST = requireMaintainerOrAdmin(postHandler);
export const PUT = requireAuth(putHandler);
