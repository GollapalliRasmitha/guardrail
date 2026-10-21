"use client";

import { Fragment, useState, type KeyboardEvent } from "react";
import { pathParts } from "@/lib/events/path-parts";

/**
 * A request path that can only wrap right after a "/". Each segment is one unbreakable piece (whitespace-nowrap, so
 * the browser can't break at hyphens either) and a <wbr> after it is the only break chance. Segments are at most
 * 28 characters, so each piece fits even on a phone.
 *
 * If a segment had to be shortened ("eval-sti…name.php"), the path is clickable: click, tap, Enter or Space shows it
 * in full (wrapping anywhere, since it's long), and again shows the short form. It stays an inline element (not a
 * <button>, which would make it one box) so it flows with "GET" and "· 404" around it; role="button" and the key
 * handler make it a real button for keyboards and screen readers.
 */
export function PathText({ path }: { path: string }) {
  const [open, setOpen] = useState(false);
  const { parts, shortened } = pathParts(path);

  if (open) {
    return <Toggle path={path} open onToggle={() => setOpen(false)} />;
  }
  const pieces = parts.map((part, i) => (
    <Fragment key={i}>
      <span className="whitespace-nowrap">{part}</span>
      <wbr />
    </Fragment>
  ));
  if (!shortened) return <span>{pieces}</span>;
  return (
    <Toggle path={path} open={false} onToggle={() => setOpen(true)}>
      {pieces}
    </Toggle>
  );
}

function Toggle({
  path,
  open,
  onToggle,
  children,
}: {
  path: string;
  open: boolean;
  onToggle: () => void;
  children?: React.ReactNode;
}) {
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onToggle();
    }
  };
  return (
    <span
      role="button"
      tabIndex={0}
      aria-expanded={open}
      aria-label={open ? `Path ${path}. Show shorter` : `Path ${path} (shortened). Show in full`}
      title={open ? undefined : path}
      onClick={onToggle}
      onKeyDown={onKeyDown}
      className={`cursor-pointer rounded underline decoration-muted/60 decoration-dotted underline-offset-4 hover:decoration-accent ${
        open ? "[overflow-wrap:anywhere]" : ""
      }`}
    >
      {open ? path : children}
    </span>
  );
}
