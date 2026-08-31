"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import type { FeedbackListParams } from "@/services/feedback.service"
import { feedbackService } from "@/services/feedback.service"

export function useFeedback(params: FeedbackListParams) {
  const query = useQuery({
    queryKey: ["admin", "feedback", params],
    queryFn: () => feedbackService.list(params),
    staleTime: 15_000,
  })

  return {
    feedback: query.data?.feedback ?? [],
    pagination: query.data?.pagination ?? { page: 1, limit: 40, total: 0 },
    isLoading: query.isLoading,
    error: query.error instanceof Error ? query.error.message : null,
    refetch: query.refetch,
  }
}

export function useFeedbackMutations() {
  const qc = useQueryClient()
  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ["admin", "feedback"] })

  const resolve = useMutation({
    mutationFn: (id: string) => feedbackService.resolve(id),
    onSuccess: invalidate,
  })

  const reopen = useMutation({
    mutationFn: (id: string) => feedbackService.reopen(id),
    onSuccess: invalidate,
  })

  const remove = useMutation({
    mutationFn: (id: string) => feedbackService.remove(id),
    onSuccess: invalidate,
  })

  return { resolve, reopen, remove }
}
