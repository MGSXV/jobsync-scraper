"use client";

import type { JobSpySourceConfig, JobSpySite } from "@/models/automation.model";
import { SitePicker } from "./jobspy-search-step/SitePicker";
import { QueryFields } from "./jobspy-search-step/QueryFields";
import { TargetingFields } from "./ats-search-step/TargetingFields";
import { RunOptionsFields } from "./ats-search-step/RunOptionsFields";

interface JobSpySearchStepProps {
  value: JobSpySourceConfig;
  onChange: (next: JobSpySourceConfig) => void;
}

// The keyword-search counterpart to AtsSearchStep. The lower two sections are
// the same components the ATS step uses — ranking and run budget are shared
// across source kinds, only the fetch parameters differ.
export function JobSpySearchStep({ value, onChange }: JobSpySearchStepProps) {
  return (
    <div className="space-y-5">
      <SitePicker
        sites={value.sites ?? []}
        onChange={(sites: JobSpySite[]) => onChange({ ...value, sites })}
      />
      <QueryFields value={value} onChange={onChange} />
      <TargetingFields value={value} onChange={onChange} />
      <RunOptionsFields value={value} onChange={onChange} />
    </div>
  );
}
