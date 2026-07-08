import { Logo } from "@/components/ui/Logo";

/**
 * Minimal authentication layout — no public Navbar/Footer, no dashboard
 * chrome. Just a centered card area with the brand mark. Real auth forms
 * are built in Phase 8 (Supabase Authentication).
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4 py-12">
      <div className="mb-8">
        <Logo priority height={34} />
      </div>
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
