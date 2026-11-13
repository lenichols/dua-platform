import Link from "next/link";
import { HeaderBar, PageShell } from "@/components/shell";

export default function NotFound() {
  return (
    <>
      <HeaderBar />
      <PageShell maxWidth="max-w-lg">
        <div className="py-20 text-center">
          <div className="hex-title text-9xl">404</div>
          <p className="mt-4 text-dust">That page isn't on the board.</p>
          <Link href="/" className="btn-accent mt-8">
            ← Home
          </Link>
        </div>
      </PageShell>
    </>
  );
}
