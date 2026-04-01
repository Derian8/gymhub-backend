import { Utensils, Target } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { useMemberActivePrescriptionQuery } from '@/modules/members/hooks/useMembers'
import { useNutritionProfilesQuery, useNutritionGuidelinesQuery } from '../hooks/useNutrition'
import { Badge, PageHeader, EmptyState } from '@/shared/components/UI'
import { CardSkeleton } from '@/shared/components/Skeleton'
import { GOAL_LABELS } from '@/shared/lib/utils'
import { useAuthStore } from '@/shared/store/authStore'
import type { NutritionProfile, NutritionGuideline } from '@/shared/types'

export function NutritionPage() {
  const [searchParams] = useSearchParams()
  const memberId = searchParams.get('member')
  const { user } = useAuthStore()
  const isMemberView = user?.role === 'member' && !memberId
  const { data: activePrescription, isLoading: activePrescriptionLoading } = useMemberActivePrescriptionQuery(
    isMemberView ? user?.memberprofile_id || 0 : 0,
  )
  const { data: profiles, isLoading: profilesLoading } = useNutritionProfilesQuery(
    memberId ? { member: memberId } : undefined,
  )
  const { data: guidelines, isLoading: guidelinesLoading } = useNutritionGuidelinesQuery()

  return (
    <div data-testid="nutrition-page" className="page-enter">
      <PageHeader
        title="Nutrición"
        subtitle={memberId ? 'Recomendaciones nutricionales del cliente seleccionado' : 'Perfiles y guías nutricionales'}
      />

      {/* My Profile */}
      <section className="mb-8">
        <h2 className="font-heading font-bold text-xl text-neutral-900 dark:text-white mb-4">
          Mi perfil nutricional
        </h2>
        {isMemberView ? (
          activePrescriptionLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <CardSkeleton lines={5} />
            </div>
          ) : !activePrescription?.perfil_nutricional ? (
            <EmptyState
              icon={<Utensils size={40} />}
              title="Sin nutrición activa"
              description="Tu trainer aún no ha asociado una guía nutricional a tu plan activo."
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <NutritionProfileCard profile={activePrescription.perfil_nutricional} />
            </div>
          )
        ) : profilesLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <CardSkeleton lines={5} />
          </div>
        ) : !profiles?.results.length ? (
          <EmptyState
            icon={<Utensils size={40} />}
            title="Sin perfil nutricional"
            description="Tu entrenador configurará tu perfil nutricional"
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {profiles.results.map((profile) => (
              <NutritionProfileCard key={profile.id} profile={profile} />
            ))}
          </div>
        )}
      </section>

      {/* Guidelines */}
      <section>
        <h2 className="font-heading font-bold text-xl text-neutral-900 dark:text-white mb-4">
          Guías de nutrición
        </h2>
        {isMemberView ? (
          activePrescriptionLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Array.from({ length: 2 }).map((_, i) => <CardSkeleton key={i} lines={3} />)}
            </div>
          ) : !activePrescription?.guias_vinculadas.length ? (
            <EmptyState
              icon={<Target size={40} />}
              title="Sin guías activas"
              description="Las guías nutricionales vinculadas por tu trainer aparecerán aquí."
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {activePrescription.guias_vinculadas.map((guideLink) => (
                <GuidelineCard key={guideLink.id} guideline={guideLink.guideline} />
              ))}
            </div>
          )
        ) : guidelinesLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} lines={3} />)}
          </div>
        ) : !guidelines?.results.length ? (
          <EmptyState
            icon={<Target size={40} />}
            title="Sin guías disponibles"
            description="Las guías nutricionales aparecerán aquí"
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {guidelines.results.map((guide) => (
              <GuidelineCard key={guide.id} guideline={guide} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function NutritionProfileCard({ profile }: { profile: NutritionProfile }) {
  return (
    <div className="card p-6" data-testid={`nutrition-profile-${profile.id}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-heading font-bold text-lg text-neutral-900 dark:text-white">
          Mi plan nutricional
        </h3>
        <Badge variant="info">{GOAL_LABELS[profile.goal_type] || profile.goal_type}</Badge>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {(profile.calorie_range_min || profile.calorie_range_max) && (
          <MacroCard
            label="Calorías"
            value={`${profile.calorie_range_min ?? '—'}-${profile.calorie_range_max ?? '—'} kcal`}
            icon="🔥"
          />
        )}
        {profile.protein_focus && (
          <MacroCard label="Proteína" value={profile.protein_focus} icon="🥩" />
        )}
        {profile.carb_strategy && (
          <MacroCard label="Carbohidratos" value={profile.carb_strategy} icon="🌾" />
        )}
        {profile.hydration_recommendation && (
          <MacroCard label="Hidratación" value={profile.hydration_recommendation} icon="💧" />
        )}
      </div>
    </div>
  )
}

function MacroCard({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <div className="bg-neutral-50 dark:bg-neutral-800/50 rounded-sm p-3 text-center">
      <p className="text-lg">{icon}</p>
      <p className="text-sm font-bold text-neutral-900 dark:text-white">{value}</p>
      <p className="text-xs text-neutral-400">{label}</p>
    </div>
  )
}

function GuidelineCard({ guideline }: { guideline: NutritionGuideline }) {
  return (
    <div className="card p-5" data-testid={`guideline-${guideline.id}`}>
      <div className="flex items-start justify-between mb-2">
        <h4 className="font-semibold text-neutral-900 dark:text-white">{guideline.title}</h4>
        <Badge variant="neutral">{GOAL_LABELS[guideline.goal_type] || guideline.goal_type}</Badge>
      </div>
      <div className="space-y-2 text-sm text-neutral-500 dark:text-neutral-400 leading-relaxed">
        <p>{guideline.description}</p>
        {guideline.recommended_foods && <p><strong>Recomendados:</strong> {guideline.recommended_foods}</p>}
        {guideline.foods_to_limit && <p><strong>Limitar:</strong> {guideline.foods_to_limit}</p>}
        {guideline.timing_suggestions && <p><strong>Timing:</strong> {guideline.timing_suggestions}</p>}
      </div>
    </div>
  )
}
