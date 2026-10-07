"use client";

import { TriangleAlert } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Toggle } from "@/components/ui/toggle";
import { JOBSPY_SITES } from "@/models/automation.model";
import type { JobSpySite } from "@/models/automation.model";

interface SitePickerProps {
  sites: JobSpySite[];
  onChange: (next: JobSpySite[]) => void;
}

export function SitePicker({ sites, onChange }: SitePickerProps) {
  const toggle = (site: JobSpySite) => {
    onChange(
      sites.includes(site) ? sites.filter((s) => s !== site) : [...sites, site],
    );
  };

  const cautions = JOBSPY_SITES.filter(
    (s) => s.caution && sites.includes(s.value),
  );

  return (
    <div className="space-y-2">
      <Label>Job boards</Label>
      <div className="flex flex-wrap gap-2">
        {JOBSPY_SITES.map((site) => (
          <Toggle
            key={site.value}
            size="sm"
            variant="outline"
            pressed={sites.includes(site.value)}
            onPressedChange={() => toggle(site.value)}
            aria-label={site.label}
          >
            {site.label}
          </Toggle>
        ))}
      </div>
      <p className="text-sm text-muted-foreground">
        These are scraped, not official APIs. Indeed is the most reliable; start
        there and add others once a run looks healthy.
      </p>
      {cautions.map((site) => (
        <p
          key={site.value}
          className="flex items-start gap-2 text-sm text-amber-600 dark:text-amber-500"
        >
          <TriangleAlert className="h-4 w-4 mt-0.5 shrink-0" />
          <span>
            <strong>{site.label}:</strong> {site.caution}
          </span>
        </p>
      ))}
    </div>
  );
}
