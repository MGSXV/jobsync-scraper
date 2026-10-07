"use client";

import type { UseFormReturn } from "react-hook-form";
import { TriangleAlert } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import type { CreateAutomationInput } from "@/models/automation.schema";

export function StepBasics({
  form,
  jobSpyEnabled,
}: {
  form: UseFormReturn<CreateAutomationInput>;
  jobSpyEnabled: boolean;
}) {
  return (
    <>
      <FormField
        control={form.control}
        name="name"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Automation Name</FormLabel>
            <FormControl>
              <Input placeholder="e.g., Full Stack Jobs Calgary" {...field} />
            </FormControl>
            <FormDescription>
              A descriptive name to identify this automation
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="jobBoard"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Job Board</FormLabel>
            <Select onValueChange={field.onChange} value={field.value}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="Select a job board" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>Track companies</SelectLabel>
                  <SelectItem value="greenhouse">Greenhouse</SelectItem>
                  <SelectItem value="lever">Lever</SelectItem>
                  <SelectItem value="ashby">Ashby</SelectItem>
                </SelectGroup>
                {/* Hidden when the sidecar isn't configured, so nobody
                    schedules a source that blocks on every run. Still shown
                    while editing an existing JobSpy automation, or the select
                    would render blank over its own value. */}
                {(jobSpyEnabled || field.value === "jobspy") && (
                  <SelectGroup>
                    <SelectLabel>Search job boards</SelectLabel>
                    <SelectItem value="jobspy">
                      JobSpy (Indeed, LinkedIn &amp; more)
                    </SelectItem>
                  </SelectGroup>
                )}
              </SelectContent>
            </Select>
            {field.value === "jobspy" && !jobSpyEnabled ? (
              // Reachable by editing an automation created while the sidecar
              // was running. Runs will finalize as blocked until it is back.
              <FormDescription className="flex items-start gap-2 text-amber-600 dark:text-amber-500">
                <TriangleAlert className="h-4 w-4 mt-0.5 shrink-0" />
                <span>
                  The JobSpy service is not configured, so this automation
                  cannot run. Start it and set JOBSPY_SERVICE_URL.
                </span>
              </FormDescription>
            ) : (
              <FormDescription>
                {field.value === "jobspy"
                  ? "Search job boards by keyword across Indeed, LinkedIn and more"
                  : "Track specific companies' job boards"}
              </FormDescription>
            )}
            <FormMessage />
          </FormItem>
        )}
      />
    </>
  );
}
