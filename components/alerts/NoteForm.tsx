"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { FormError } from "@/components/ui/FormError";
import { addAlertNote } from "@/lib/api/alerts";
import { errorMessage } from "@/lib/api/client";

const MAX = 2000;

/** Add a note to the incident timeline. */
export function NoteForm({ id }: { id: number }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await addAlertNote(id, note);
      setNote("");
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <label htmlFor="note" className="block text-sm font-medium">
        Add a note
      </label>
      <textarea
        id="note"
        className="input min-h-24 resize-y"
        value={note}
        maxLength={MAX}
        onChange={(e) => setNote(e.target.value)}
        placeholder="What you checked or did, e.g. “No sign-in succeeded; blocked the IP.”"
        aria-describedby="note-help"
      />
      <p id="note-help" className="text-xs text-muted">
        Notes appear on the timeline. {note.length}/{MAX}
      </p>
      <FormError message={error} />
      <Button type="submit" variant="ghost" busy={busy} disabled={!note.trim()}>
        Add note
      </Button>
    </form>
  );
}
