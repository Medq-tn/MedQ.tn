'use client'

import { useAuth } from '@/contexts/AuthContext'
import { UniversalHeader } from '@/components/layout/UniversalHeader';
import { AppSidebar, AppSidebarProvider } from '@/components/layout/AppSidebar';
import { SidebarInset } from '@/components/ui/sidebar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { useTranslation } from 'react-i18next'
import { User, Mail, GraduationCap, Calendar, Shield, Crown, Clock } from 'lucide-react'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { ProfileCompletionGuard } from '@/components/ProfileCompletionGuard'

export default function ProfilePageRoute() {
  const { user } = useAuth()
  const { t } = useTranslation()

  return (
    <ProtectedRoute>
      <ProfileCompletionGuard>
        <AppSidebarProvider>
          <div className="flex min-h-screen w-full">
            <AppSidebar />
            <SidebarInset className="flex-1 flex flex-col">
              {/* Universal Header */}
              <UniversalHeader
                title="Profile"
              />

              {/* Main Content */}
              <div className="flex-1 bg-gray-50 dark:bg-gray-900">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                  <div className="space-y-4 sm:space-y-6">

            <div className="grid gap-4 sm:gap-6 md:grid-cols-2">
              {/* Personal Information Card */}
              <Card className="backdrop-blur-sm bg-white/80 dark:bg-gray-800/80 border-blue-200 dark:border-blue-800 shadow-lg hover:shadow-xl transition-all duration-300">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
                    <User className="h-5 w-5" />
                    {t('profile.personalInfo')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center space-x-4">
                    <Avatar className="h-16 w-16">
                      <AvatarImage src={user?.image} alt={user?.name || user?.email} />
                      <AvatarFallback>
                        {user?.name?.charAt(0) || user?.email?.charAt(0) || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <h3 className="text-lg font-semibold">{user?.name || t('profile.noName')}</h3>
                      <p className="text-muted-foreground">{user?.email}</p>
                    </div>
                  </div>

                  <div className="grid gap-4">
                    <div className="space-y-2">
                      <div className="text-sm font-medium">{t('profile.name')}</div>
                      <div className="flex items-center gap-2 text-sm">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span>{user?.name || t('profile.noName')}</span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="text-sm font-medium">{t('profile.email')}</div>
                      <div className="flex items-center gap-2 text-sm">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <span>{user?.email}</span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="text-sm font-medium">{t('profile.gender')}</div>
                      <div className="flex items-center gap-2 text-sm">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span>
                          {user?.sexe === 'M' ? t('profile.male') : 
                           user?.sexe === 'F' ? t('profile.female') : 
                           t('profile.noName')}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="text-sm font-medium">{t('profile.level')}</div>
                      <div className="flex items-center gap-2 text-sm">
                        <GraduationCap className="h-4 w-4 text-muted-foreground" />
                        <span>{user?.niveau?.name || t('profile.noName')}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Account Information Card */}
              <Card className="backdrop-blur-sm bg-white/80 dark:bg-gray-800/80 border-blue-200 dark:border-blue-800 shadow-lg hover:shadow-xl transition-all duration-300">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
                    <Shield className="h-5 w-5" />
                    {t('profile.accountInfo')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid gap-4">
                    <div className="space-y-2">
                      <div className="text-sm font-medium">{t('profile.role')}</div>
                      <div className="flex items-center gap-2 text-sm">
                        <Shield className="h-4 w-4 text-muted-foreground" />
                        <span>
                          {user?.role === 'admin' ? t('profile.administrator') : t('profile.student')}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="text-sm font-medium">{t('profile.profileStatus')}</div>
                      <div className="flex items-center gap-2">
                        <Badge variant={user?.profileCompleted ? 'default' : 'destructive'}>
                          {user?.profileCompleted ? t('profile.complete') : t('profile.incomplete')}
                        </Badge>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="text-sm font-medium">{t('settings.lastPasswordChange')}</div>
                      <div className="flex items-center gap-2 text-sm">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span>
                          {user?.passwordUpdatedAt ? 
                            new Date(user.passwordUpdatedAt).toLocaleDateString('fr-FR') : 
                            t('settings.noPasswordSetMessage')}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Subscription Information Card */}
            <Card className="backdrop-blur-sm bg-white/80 dark:bg-gray-800/80 border-blue-200 dark:border-blue-800 shadow-lg hover:shadow-xl transition-all duration-300">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
                  <Crown className="h-5 w-5" />
                  {t('profile.subscriptionDetails')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <div className="text-sm font-medium">{t('profile.subscriptionStatus')}</div>
                    <div className="flex items-center gap-2">
                      <Badge variant={user?.hasActiveSubscription ? 'default' : 'secondary'}>
                        {user?.hasActiveSubscription ? t('profile.active') : t('profile.freePlan')}
                      </Badge>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="text-sm font-medium">{t('profile.accessLevel')}</div>
                    <div className="flex items-center gap-2 text-sm">
                      <Crown className="h-4 w-4 text-muted-foreground" />
                      <span>
                        {user?.role === 'admin' ? t('profile.fullAccessAdmin') :
                         user?.hasActiveSubscription ? t('profile.premiumAccess') : t('profile.freeAccess')}
                      </span>
                    </div>
                  </div>

                  {user?.hasActiveSubscription && user?.subscriptionExpiresAt && (
                    <div className="space-y-2">
                      <div className="text-sm font-medium">{t('profile.expiresOn')}</div>
                      <div className="flex items-center gap-2 text-sm">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span>
                          {new Date(user.subscriptionExpiresAt).toLocaleDateString('fr-FR', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })}
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <div className="text-sm font-medium">{t('profile.contentAccess')}</div>
                    <div className="flex items-center gap-2 text-sm">
                      <Shield className="h-4 w-4 text-muted-foreground" />
                      <span>
                        {user?.role === 'admin' ? t('profile.allSpecialtiesAndLectures') :
                         user?.hasActiveSubscription ? t('profile.allSpecialtiesAndLectures') : t('profile.freeSpecialtiesAndLecturesOnly')}
                      </span>
                    </div>
                  </div>
                </div>

                {!user?.hasActiveSubscription && user?.role !== 'admin' && (
                  <div className="mt-4 p-4 bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-lg border border-blue-200 dark:border-blue-700">
                    <div className="flex items-center gap-2 mb-2">
                      <Crown className="h-4 w-4 text-yellow-600" />
                      <span className="font-medium">{t('profile.upgradeToPremium')}</span>
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">
                      {t('profile.upgradeDescription')}
                    </p>
                    <button className="text-sm bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent font-medium hover:from-blue-700 hover:to-blue-900 transition-all duration-200">
                      {t('profile.learnMoreAboutPremium')}
                    </button>
                  </div>
                )}
              </CardContent>
            </Card>
                  </div>
                </div>
              </div>
            </SidebarInset>
          </div>
        </AppSidebarProvider>
      </ProfileCompletionGuard>
    </ProtectedRoute>
  )
}