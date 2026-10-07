"use client";

import { TriangleAlert } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { APP_CONSTANTS } from "@/lib/constants";
import { JOBSPY_COUNTRIES } from "@/models/automation.model";
import type { JobSpySourceConfig, JobSpyJobType } from "@/models/automation.model";

const JOB_TYPE_OPTIONS: { value: JobSpyJobType | "any"; label: string }[] = [
  { value: "any", label: "Any" },
  { value: "fulltime", label: "Full-time" },
  { value: "parttime", label: "Part-time" },
  { value: "contract", label: "Contract" },
  { value: "internship", label: "Internship" },
];

const HOURS_OPTIONS: { value: string; label: string }[] = [
  { value: "any", label: "Any time" },
  { value: "24", label: "Last 24 hours" },
  { value: "72", label: "Last 3 days" },
  { value: "168", label: "Last week" },
  { value: "336", label: "Last 2 weeks" },
  { value: "720", label: "Last 30 days" },
];

interface QueryFieldsProps {
  value: JobSpySourceConfig;
  onChange: (next: JobSpySourceConfig) => void;
}

export function QueryFields({ value, onChange }: QueryFieldsProps) {
  const country = value.countryIndeed ?? APP_CONSTANTS.JOBSPY_DEFAULT_COUNTRY;
  const needsCountry =
    value.sites?.includes("indeed") || value.sites?.includes("glassdoor");
  const glassdoorUnsupported =
    value.sites?.includes("glassdoor") &&
    !JOBSPY_COUNTRIES.find((c) => c.value === country)?.glassdoor;

  const resultsWanted =
    value.resultsWanted ?? APP_CONSTANTS.JOBSPY_DEFAULT_RESULTS_WANTED;

  return (
    <>
      <div className="space-y-2">
        <Label>What to search for</Label>
        <Input
          placeholder="e.g., backend engineer python"
          value={value.searchTerm ?? ""}
          onChange={(e) => onChange({ ...value, searchTerm: e.target.value })}
        />
        <p className="text-sm text-muted-foreground">
          Indeed also searches descriptions, so you can use{" "}
          <code>&quot;exact phrase&quot;</code> and <code>-exclude</code> here.
        </p>
      </div>

      <div className="space-y-2">
        <Label>Location</Label>
        <Input
          placeholder="e.g., Calgary, AB"
          value={value.location ?? ""}
          onChange={(e) => onChange({ ...value, location: e.target.value })}
        />
        <p className="text-sm text-muted-foreground">
          A city, region, or country. Leave blank to search everywhere the board
          allows.
        </p>
      </div>

      {needsCountry && (
        <div className="space-y-2">
          <Label>Country</Label>
          <Select
            value={country}
            onValueChange={(next) =>
              onChange({ ...value, countryIndeed: next })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              {JOBSPY_COUNTRIES.map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-sm text-muted-foreground">
            Required by Indeed and Glassdoor; the other boards ignore it.
          </p>
          {glassdoorUnsupported && (
            <p className="flex items-start gap-2 text-sm text-amber-600 dark:text-amber-500">
              <TriangleAlert className="h-4 w-4 mt-0.5 shrink-0" />
              <span>
                Glassdoor does not cover this country — it will return nothing.
              </span>
            </p>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Job type</Label>
          <Select
            value={value.jobType ?? "any"}
            onValueChange={(next) =>
              onChange({
                ...value,
                jobType: next === "any" ? undefined : (next as JobSpyJobType),
              })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {JOB_TYPE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Posted within</Label>
          <Select
            value={value.hoursOld ? String(value.hoursOld) : "any"}
            onValueChange={(next) =>
              onChange({
                ...value,
                hoursOld: next === "any" ? undefined : Number(next),
              })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {HOURS_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Results per board: {resultsWanted}</Label>
        <Slider
          min={5}
          max={APP_CONSTANTS.JOBSPY_MAX_RESULTS_WANTED}
          step={5}
          value={[resultsWanted]}
          onValueChange={(next) =>
            onChange({ ...value, resultsWanted: next[0] })
          }
        />
        <p className="text-sm text-muted-foreground">
          How many listings to pull from each board before ranking. Higher means
          longer runs and more chance of being rate-limited.
        </p>
      </div>

      <div className="flex items-start justify-between gap-4 rounded-lg border p-3">
        <div className="space-y-1">
          <Label htmlFor="jobspy-remote-only">Remote only</Label>
          <p className="text-sm text-muted-foreground">
            Ask each board for remote postings only.
          </p>
        </div>
        <Switch
          id="jobspy-remote-only"
          checked={value.isRemote === true}
          onCheckedChange={(checked) =>
            onChange({ ...value, isRemote: checked })
          }
        />
      </div>

      <div className="flex items-start justify-between gap-4 rounded-lg border p-3">
        <div className="space-y-1">
          <Label htmlFor="jobspy-fetch-descriptions">
            Fetch full descriptions
          </Label>
          <p className="text-sm text-muted-foreground">
            Indeed and LinkedIn omit descriptions from search results, and AI
            matching needs them. Costs one extra request per listing — turn off
            only if a board is rate-limiting you.
          </p>
        </div>
        <Switch
          id="jobspy-fetch-descriptions"
          checked={value.fetchDescription !== false}
          onCheckedChange={(checked) =>
            onChange({ ...value, fetchDescription: checked })
          }
        />
      </div>
    </>
  );
}
