import Link from "next/link";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import type { Song } from "@/lib/types";

interface SongCardProps {
  song: Song;
}

export function SongCard({ song }: SongCardProps) {
  const formattedDate = new Date(song.createdAt).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <Link href={`/songs/${song.id}`}>
      <Card className="hover:border-primary/50 transition-colors cursor-pointer">
        <CardHeader>
          <CardTitle>{song.name}</CardTitle>
          <p className="text-base text-muted-foreground">{formattedDate}</p>
        </CardHeader>
      </Card>
    </Link>
  );
}
