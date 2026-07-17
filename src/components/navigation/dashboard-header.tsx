import Link from "next/link";
import { HeaderSearchButton } from "@/components/search/header-search-button";
import { AccountMenu } from "@/components/navigation/account-menu";

type Props = {
  email: string;
  versionLabel: string;
};

export function DashboardHeader({ email, versionLabel }: Props) {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-md lg:pl-56">
      <div className="mx-auto flex max-w-lg items-center justify-between gap-3 px-4 py-2.5 lg:max-w-6xl xl:max-w-7xl">
        <Link
          href="/today"
          className="min-w-0 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <span className="block text-lg font-semibold tracking-tight text-foreground">
            LifeOS
          </span>
        </Link>

        <div className="flex shrink-0 items-center gap-2">
          <HeaderSearchButton />
          <AccountMenu email={email} versionLabel={versionLabel} />
        </div>
      </div>
    </header>
  );
}
