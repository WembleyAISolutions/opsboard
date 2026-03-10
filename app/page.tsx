import { DesktopLiteShell } from "@/components/desktop-lite-shell";
import { coreModules } from "@/lib/mock-data";

export default function HomePage() {
  return <DesktopLiteShell modules={coreModules} />;
}
