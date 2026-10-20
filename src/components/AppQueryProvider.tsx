"use client"

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { useState } from "react"
import { isRateLimited } from "@/lib/clientApi"

export default function AppQueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            gcTime: 30 * 60_000,
            refetchOnWindowFocus: false,
            retry: (failureCount, error) => !isRateLimited(error) && failureCount < 2,
            retryDelay: (attempt) => Math.min(1_000 * 2 ** attempt, 10_000),
          },
        },
      }),
  )

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}
