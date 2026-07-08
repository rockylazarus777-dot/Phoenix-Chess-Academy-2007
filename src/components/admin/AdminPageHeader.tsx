import Link from "next/link";

interface AdminPageHeaderProps {
  title: string;
  description?: string;
  action?: { href: string; label: string };
}

export function AdminPageHeader({ title, description, action }: AdminPageHeaderProps) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-h4 text-foreground">{title}</h1>
        {description ? <p className="mt-1 text-body-sm text-muted-foreground">{description}</p> : null}
      </div>
      {action ? (
        <Link
          href={action.href}
          className="rounded-md bg-primary px-4 py-2 text-body-sm font-medium text-primary-foreground hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          {action.label}
        </Link>
      ) : null}
    </div>
  );
}
