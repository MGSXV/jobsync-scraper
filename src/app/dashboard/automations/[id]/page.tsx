import { AutomationDetailContainer } from "@/components/automations/AutomationDetailContainer";
import { isJobSpyEnabled } from "@/lib/scraper/jobspy";

async function AutomationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="col-span-3">
      <AutomationDetailContainer
        automationId={id}
        jobSpyEnabled={isJobSpyEnabled()}
      />
    </div>
  );
}

export default AutomationDetailPage;
