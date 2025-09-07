import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, requireMaintainerOrAdmin, AuthenticatedRequest } from '@/lib/auth-middleware';

export async function GET(
  request: Request,
  context: any
) {
  try {
    const rawId = context.params?.sessionId ?? '';
    const cleanedId = rawId.trim().replace(/[\u200B-\u200D\uFEFF]/g, '');
    const url = new URL(request.url);
    const debug = url.searchParams.get('debug') === '1';

    console.log('[session GET] incoming', { rawId, cleanedId });

  const session = await prisma.session.findUnique({
      where: { id: cleanedId },
      include: {
        specialty: { select: { id: true, name: true } },
        niveau: { select: { id: true, name: true } },
        semester: { select: { id: true, name: true, order: true } }
      }
    });

    if (!session) {
      const sample = await prisma.session.findMany({
        take: 5,
        select: { id: true, name: true, specialtyId: true }
      });
      return NextResponse.json(
        {
          error: 'Session not found',
          requestedId: cleanedId,
          rawId,
          sample,
          envDbUrlPresent: !!process.env.DATABASE_URL,
          totalSessions: await prisma.session.count(),
        },
        { status: 404 }
      );
    }

    if (debug) {
      return NextResponse.json({ session, debug: { fetchedAt: new Date().toISOString() } });
    }

    return NextResponse.json(session);
  } catch (error) {
    console.error('Error fetching session:', error);
    return NextResponse.json(
      { error: 'Failed to fetch session' },
      { status: 500 }
    );
  }
}

// Update session (name, urls, niveau/semester/specialty reassignment). Maintainer limited to own niveau.
export const PATCH = requireMaintainerOrAdmin(async (request: AuthenticatedRequest, context: any) => {
  try {
    const rawId = context.params?.sessionId ?? '';
    const id = rawId.trim();
    const data = await request.json();
    const { name, pdfUrl, correctionUrl, niveauId, semesterId, specialtyId } = data;

    // If maintainer, enforce niveau ownership
    if (request.user?.role === 'maintainer') {
      const maintainer = await prisma.user.findUnique({ where: { id: request.user.userId }, select: { niveauId: true } });
      if (!maintainer?.niveauId) return NextResponse.json({ error: 'Maintainer niveau not set' }, { status: 400 });
      // Prevent changing to different niveau
      if (niveauId && niveauId !== maintainer.niveauId) {
        return NextResponse.json({ error: 'Not allowed to change niveau' }, { status: 403 });
      }
      // Ensure session belongs to same niveau (if session has niveau)
      const existing = await prisma.session.findUnique({ where: { id }, select: { niveauId: true } });
      if (existing?.niveauId && existing.niveauId !== maintainer.niveauId) {
        return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
      }
    }

    const updated = await prisma.session.update({
      where: { id },
      data: {
        ...(name ? { name } : {}),
        ...(pdfUrl !== undefined ? { pdfUrl } : {}),
        ...(correctionUrl !== undefined ? { correctionUrl } : {}),
        ...(niveauId !== undefined ? { niveauId } : {}),
        ...(semesterId !== undefined ? { semesterId } : {}),
        ...(specialtyId !== undefined ? { specialtyId } : {}),
      },
      include: {
        specialty: { select: { id: true, name: true } },
        niveau: { select: { id: true, name: true } },
        semester: { select: { id: true, name: true, order: true } }
      }
    });
    return NextResponse.json(updated);
  } catch (e) {
    console.error('PATCH /api/sessions/[id] error', e);
    return NextResponse.json({ error: 'Failed to update session' }, { status: 500 });
  }
});

// Delete session
export const DELETE = requireMaintainerOrAdmin(async (request: AuthenticatedRequest, context: any) => {
  try {
    const rawId = context.params?.sessionId ?? '';
    const id = rawId.trim();
    if (request.user?.role === 'maintainer') {
      const maintainer = await prisma.user.findUnique({ where: { id: request.user.userId }, select: { niveauId: true } });
      const existing = await prisma.session.findUnique({ where: { id }, select: { niveauId: true } });
      if (!maintainer?.niveauId || (existing?.niveauId && existing.niveauId !== maintainer.niveauId)) {
        return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
      }
    }
    await prisma.session.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('DELETE /api/sessions/[id] error', e);
    return NextResponse.json({ error: 'Failed to delete session' }, { status: 500 });
  }
});
