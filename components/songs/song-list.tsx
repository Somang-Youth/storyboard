"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { SongCard } from "./song-card";
import type { Song } from "@/lib/types";
import { HugeiconsIcon } from "@hugeicons/react";
import { SearchIcon } from "@hugeicons/core-free-icons";

interface SongListProps {
  songs: Song[];
}

export function SongList({ songs }: SongListProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredSongs = songs.filter((song) =>
    song.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const showEmptyState = songs.length === 0;
  const showSearchEmptyState = !showEmptyState && filteredSongs.length === 0;

  return (
    <div className="space-y-4">
      <div className="relative">
        <HugeiconsIcon
          icon={SearchIcon}
          strokeWidth={2}
          className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-muted-foreground"
        />
        <Input
          type="text"
          placeholder="곡 이름 검색..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {showEmptyState && (
        <div className="text-center text-muted-foreground py-8">
          곡이 없습니다
        </div>
      )}

      {showSearchEmptyState && (
        <div className="text-center text-muted-foreground py-8">
          검색 결과가 없습니다
        </div>
      )}

      {!showEmptyState && !showSearchEmptyState && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSongs.map((song) => (
            <SongCard key={song.id} song={song} />
          ))}
        </div>
      )}
    </div>
  );
}
