import { getResumeList } from "@/actions/profile.actions";
import { AutomationContainer } from "@/components/automations/AutomationContainer";
import { APP_CONSTANTS } from "@/lib/constants";
import { isJobSpyEnabled } from "@/lib/scraper/jobspy";

export default async function AutomationsPage() {
  const resumeResult = await getResumeList(
    1,
    100,
    APP_CONSTANTS.MIN_RESUME_SECTIONS_FOR_SELECTION,
  );
  const resumes =
    resumeResult?.data?.map((r: { id: string; title: string }) => ({
      id: r.id,
      title: r.title,
    })) || [];

  // Read on the server: whether the JobSpy sidecar is configured is runtime
  // state, so the wizard only offers the source when it can actually run.
  const jobSpyEnabled = isJobSpyEnabled();

  return (
    <div className="col-span-3">
      <AutomationContainer resumes={resumes} jobSpyEnabled={jobSpyEnabled} />
    </div>
  );
}
