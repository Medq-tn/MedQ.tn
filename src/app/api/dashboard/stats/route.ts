import { NextResponse } from 'next/server';
import { requireAuth, AuthenticatedRequest } from '@/lib/auth-middleware';
import { prisma } from '@/lib/prisma';

async function getHandler(request: AuthenticatedRequest) {
  try {
    const userId = request.user?.userId;
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get user with their niveau information
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { 
        id: true, 
        role: true, 
        niveauId: true
      }
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Build where clause for user's niveau
    const whereClause: Record<string, unknown> = { userId };

    if (user.role !== 'admin' && user.niveauId) {
      whereClause.lecture = {
        specialty: {
          niveauId: user.niveauId
        }
      };
    }

    // Get user progress data
    const progressData = await prisma.userProgress.findMany({
      where: whereClause,
      include: {
        lecture: {
          select: {
            id: true,
            title: true,
            specialty: {
              select: {
                name: true
              }
            }
          }
        }
      },
      orderBy: {
        lastAccessed: 'desc'
      }
    });

    // Calculate statistics
    const totalQuestions = progressData.length;
    const completedQuestions = progressData.filter(p => p.completed).length;
    const averageScore = progressData.length > 0 
      ? progressData.reduce((sum, p) => sum + (p.score || 0), 0) / progressData.length
      : 0;

    // Calculate learning streak (consecutive days with activity)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const activityDates = new Set(
      progressData.map(p => {
        const date = new Date(p.lastAccessed);
        date.setHours(0, 0, 0, 0);
        return date.getTime();
      })
    );

    let learningStreak = 0;
    let currentDate = new Date(today);    while (activityDates.has(currentDate.getTime())) {
      learningStreak++;
      currentDate.setDate(currentDate.getDate() - 1);
    }

    // Get total unique lectures
    const uniqueLectures = new Set(progressData.map(p => p.lectureId)).size;

    // Get last accessed lecture
    const lastLecture = progressData.length > 0 ? progressData[0] : null;

    return NextResponse.json({
      averageScore: Math.round(averageScore * 10) / 10, // Round to 1 decimal
      totalQuestions,
      completedQuestions,
      learningStreak,
      totalLectures: uniqueLectures,
      lastLecture: lastLecture ? {
        id: lastLecture.lecture.id,
        title: lastLecture.lecture.title,
        specialty: lastLecture.lecture.specialty,
        progress: Math.round((completedQuestions / totalQuestions) * 100),
        totalQuestions,
        completedQuestions,
        lastAccessed: lastLecture.lastAccessed
      } : null
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard stats' },
      { status: 500 }
    );
  }
}

export const GET = requireAuth(getHandler); 