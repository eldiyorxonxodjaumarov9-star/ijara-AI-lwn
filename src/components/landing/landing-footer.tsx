import Link from "next/link";

export function LandingFooter() {
  return (
    <footer className="border-t border-white/10 py-10">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 sm:flex-row sm:px-6 lg:px-8">
        <p className="text-sm text-slate-500">
          &copy; {new Date().getFullYear()} Arenda AI. Barcha huquqlar himoyalangan.
        </p>
        <div className="flex items-center gap-6 text-sm text-slate-500">
          <a href="/#bosh" className="transition-colors hover:text-white">
            Bosh sahifa
          </a>
          <a href="/#funksiyalar" className="transition-colors hover:text-white">
            Funksiyalar
          </a>
          <Link href="/ijara-qidiruv" className="transition-colors hover:text-white">
            Ijara qidiruv
          </Link>
          <Link href="/ijara-egalari" className="transition-colors hover:text-white">
            Ijara egalari
          </Link>
          <Link href="/dashboard" className="transition-colors hover:text-cyan-400">
            Dashboard
          </Link>
        </div>
      </div>
    </footer>
  );
}
