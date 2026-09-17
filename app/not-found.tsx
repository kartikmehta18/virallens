import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-xl flex-col items-center justify-center px-6 py-24 text-center">
      <p className="text-accent font-mono text-sm">404</p>
      <h1 className="display mt-4 text-[40px] sm:text-[48px]">
        This page <b>didn&apos;t go viral</b>
      </h1>
      <p className="text-muted mt-4 text-[15px]">
        The post or page you&apos;re looking for doesn&apos;t exist, or was fetched in a previous session.
      </p>
      <div className="mt-8 flex gap-3">
        <Link href="/explore" className="btn-primary">
          Back to Explore
        </Link>
        <Link href="/" className="btn-secondary">
          Home
        </Link>
      </div>
    </div>
  );
}
