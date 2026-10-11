import { createFileRoute } from '@tanstack/react-router'
import { Agent } from '@/containers/app/agent'

export const Route = createFileRoute('/_layout/app/agent')({
  component: Agent,
})
