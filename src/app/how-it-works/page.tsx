/**
 * ROUTING · app/how-it-works/page.tsx — the URL  /how-it-works.
 *
 * Only wiring: "when someone opens /how-it-works, show the HowItWorks page".
 */
import { HowItWorks } from "@/components/HowItWorks";

export const metadata = { title: "How it works · GenUI Studio" };

export default function Page() {
  return <HowItWorks />;
}
