import React from 'react';
import { Link } from 'react-router-dom';
import { Building2, MapPin, BookOpen, Users, Sparkles } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import type { CommunityInstitutionCard } from '@/services/communityApi';
import { CompactRatingBar } from '@/components/community/StarRating';

export const SchoolCard: React.FC<{ school: CommunityInstitutionCard }> = ({ school }) => {
  return (
    <Link to={`/escolas/${school.id}`} className="block transition-transform hover:-translate-y-0.5">
      <Card className="h-full border-border/80 shadow-sm hover:shadow-md">
        <CardContent className="flex gap-4 p-4">
          {school.logoUrl ? (
            <img
              src={school.logoUrl}
              alt=""
              className="h-16 w-16 shrink-0 rounded-lg object-cover bg-muted"
            />
          ) : (
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-muted">
              <Building2 className="h-8 w-8 text-muted-foreground" aria-hidden />
            </div>
          )}
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex items-center gap-2 min-w-0">
              <h2 className="truncate font-semibold leading-tight">{school.name}</h2>
              {school.directoryFeatured ? (
                <span className="inline-flex items-center gap-0.5 shrink-0 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-200">
                  <Sparkles className="h-3 w-3" aria-hidden />
                  Patrocinado
                </span>
              ) : null}
            </div>
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span className="truncate">{school.address || '—'}</span>
            </p>
            <div className="pt-1">
              <CompactRatingBar
                variant="mini"
                average={school.ratingAverage ?? null}
                count={school.ratingCount ?? 0}
              />
            </div>
            <div className="flex flex-wrap gap-2 pt-1 text-xs text-muted-foreground">
              <span className="rounded-md bg-muted px-2 py-0.5">{school.institutionType}</span>
              {school.academicType ? (
                <span className="rounded-md bg-muted px-2 py-0.5">{school.academicType}</span>
              ) : null}
              <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5">
                <BookOpen className="h-3 w-3" aria-hidden />
                {school.courseCount} ofertas
              </span>
              <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5">
                <Users className="h-3 w-3" aria-hidden />
                {school.followerCount}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
};
