import { Panel } from "@/components/ui/Panel";
import { OverviewView } from "@/components/views/OverviewView";
import { demoWorldForRequest } from "@/lib/demo/request";

export default function DemoOverviewPage() {
  const world = demoWorldForRequest();
  return (
    <OverviewView
      base="/demo"
      data={world.overview}
      aside={
        <Panel title="About this demo">
          <p className="text-sm text-muted">
            A made-up day on two sites. The alerts weren&apos;t written by hand: the fake events went through
            the same six detection rules as real ones. Buttons that change things are switched off.
          </p>
        </Panel>
      }
    />
  );
}
