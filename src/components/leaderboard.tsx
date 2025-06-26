"use client";

import type { PlayerScore } from '@/lib/types';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Crown } from 'lucide-react';

interface LeaderboardProps {
  scores: PlayerScore[];
}

export function Leaderboard({ scores }: LeaderboardProps) {
  const getMedal = (index: number) => {
    switch (index) {
      case 0:
        return <Crown className="w-5 h-5 text-yellow-500" />;
      case 1:
        return <Crown className="w-5 h-5 text-gray-400" />;
      case 2:
        return <Crown className="w-5 h-5 text-yellow-700" />;
      default:
        return <span>{index + 1}</span>;
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Crown className="w-6 h-6 text-primary" />
          Ranking de Pontuação (Top 10)
        </CardTitle>
        <CardDescription>Veja os melhores jogadores!</CardDescription>
      </CardHeader>
      <CardContent>
        {scores.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">Pos.</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead className="text-right">Pontuação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {scores.map((player, index) => (
                <TableRow key={`${player.name}-${index}`} className={index < 3 ? 'font-bold' : ''}>
                  <TableCell>
                    <div className="flex items-center justify-center h-full">
                      {getMedal(index)}
                    </div>
                  </TableCell>
                  <TableCell>{player.name}</TableCell>
                  <TableCell className="text-right">{player.score}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="text-center text-muted-foreground">
            Ainda não há pontuações. Seja o primeiro!
          </p>
        )}
      </CardContent>
    </Card>
  );
}
