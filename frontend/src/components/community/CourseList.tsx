import React from 'react';
import type { CommunityCourseItem } from '@/services/communityApi';

export const CourseList: React.FC<{ courses: CommunityCourseItem[]; title?: string }> = ({
  courses,
  title = 'Ofertas divulgadas',
}) => {
  if (!courses.length) {
    return (
      <p className="text-sm text-muted-foreground rounded-md border bg-muted/20 px-4 py-3 text-center leading-relaxed">
        Esta instituição ainda não publicou ofertas no diretório.
      </p>
    );
  }

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">{title}</h2>
      <ul className="divide-y rounded-lg border bg-card">
        {courses.map((c) => (
          <li key={c.id} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium">{c.name}</p>
              {c.description ? (
                <p className="text-sm text-muted-foreground line-clamp-2">{c.description}</p>
              ) : null}
            </div>
            <div className="shrink-0 text-sm font-medium tabular-nums">
              {c.price != null && c.price > 0 ? (
                <span>{c.price.toLocaleString('pt-AO', { style: 'currency', currency: 'AOA' })}</span>
              ) : (
                <span className="text-muted-foreground">Preço sob consulta</span>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
};
