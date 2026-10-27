"use client";

import type { ReactNode } from "react";
import { Button } from "./ui";

export function ConfirmButton({ message, children }: { message: string; children: ReactNode }) {
  return (
    <Button type="submit" variant="danger" size="sm" onClick={(e) => !window.confirm(message) && e.preventDefault()}>
      {children}
    </Button>
  );
}
