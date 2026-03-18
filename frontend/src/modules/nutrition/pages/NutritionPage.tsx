import { Utensils, Target, Flame } from 'lucide-react'
import { useNutritionProfilesQuery, useNutritionGuidelinesQuery } from '../hooks/useNutrition'
import { Badge, PageHeader, EmptyState } from '@/shared/components/UI'
import { CardSkeleton } from '@/shared/components/Skeleton'
import { GOAL_LABELS } from '@/shared/lib/utils'
import type { NutritionProfile, NutritionGuideline } from '@/shared/types'

export function NutritionPage() {
  const { data: profiles, isLoading: profilesLoading } = useNutritionProfilesQuery()
  const { data: guidelines, isLoading: guidelinesLoading } = useNutritionGuidelinesQuery()

  return (
    <div data-testid="nutrition-page" className="page-enter">
      <PageHeader title="Nutrición" subtitle="Perfiles y guías nutricionales" />

      {/* My Profile */}
      <section className="mb-8">
        <h2 className="font-heading font-bold text-xl text-neutral-900 dark:text-white mb-4">
          Mi perfil nutricional
        </h2>
        {profilesLoading ? (
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
        {guidelinesLoading ? (
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
        {profile.calories_target && (
          <MacroCard label="Calorías" value={`${profile.calories_target} kcal`} icon="🔥" />
        )}
        {profile.protein_g && (
          <MacroCard label="Proteína" value={`${profile.protein_g}g`} icon="🥩" />
        )}
        {profile.carbs_g && (
          <MacroCard label="Carbohidratos" value={`${profile.carbs_g}g`} icon="🌾" />
        )}
        {profile.fat_g && (
          <MacroCard label="Grasas" value={`${profile.fat_g}g`} icon="🥑" />
        )}
      </div>

      {profile.notes && (
        <p className="mt-4 text-sm text-neutral-500 dark:text-neutral-400 border-t border-neutral-100 dark:border-neutral-800 pt-3">
          {profile.notes}
        </p>
      )}
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
      <p className="text-sm text-neutral-500 dark:text-neutral-400 leading-relaxed line-clamp-4">
        {guideline.content}
      </p>
    </div>
  )
}
