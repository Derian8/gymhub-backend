import { create } from 'zustand'
import type { BackendIssue } from '@/shared/api/backendStatus'

interface BackendStatusState {
  issue: BackendIssue | null
  setIssue: (issue: BackendIssue) => void
  clearIssue: () => void
}

export const useBackendStatusStore = create<BackendStatusState>((set) => ({
  issue: null,
  setIssue: (issue) => set({ issue }),
  clearIssue: () => set({ issue: null }),
}))
