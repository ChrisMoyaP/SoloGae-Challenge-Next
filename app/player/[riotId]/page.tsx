import PlayerPageClient from "./PlayerPageClient"

interface PageProps {
  params: Promise<{ riotId: string }>
}

export default async function PlayerPage({ params }: PageProps) {
  const { riotId } = await params

  return <PlayerPageClient riotId={riotId} />
}
