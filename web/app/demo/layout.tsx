import { DemoTop } from "@/components/demo/DemoTop";
import { DEMO_FAMILY, DEMO_AS_OF } from "@/lib/demo/data";

export const metadata = { title: "Demo · FolioLense" };

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="demo">
      <DemoTop />
      <div className="demo-body">
        <div className="demo-crumb">
          <span>{DEMO_FAMILY}</span>
          <span className="mut">as of {DEMO_AS_OF}</span>
        </div>
        {children}
      </div>
    </div>
  );
}
