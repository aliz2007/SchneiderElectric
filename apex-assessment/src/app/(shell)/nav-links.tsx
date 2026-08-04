"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Icon, { type IconName } from "./nav-icon";

export type NavItem = { href: string; label: string; ico: IconName };

export default function NavLinks({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <>
      {items.map((it) => {
        const active = pathname === it.href || (it.href !== "/" && pathname.startsWith(it.href + "/"));
        return (
          <Link key={it.href} href={it.href} className={`nav-link${active ? " active" : ""}`}>
            <span className="ico"><Icon name={it.ico} /></span>
            {it.label}
          </Link>
        );
      })}
    </>
  );
}
