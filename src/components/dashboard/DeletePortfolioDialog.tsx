"use client";

import { useState } from "react";
import { usePortfolioStore } from "@/stores/portfolioStore";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function DeletePortfolioDialog({
  portfolioId,
  portfolioName,
  children,
}: {
  portfolioId: string;
  portfolioName: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const deletePortfolio = usePortfolioStore((s) => s.deletePortfolio);

  function handleDelete() {
    deletePortfolio(portfolioId);
    toast.success(`Portfolio "${portfolioName}" deleted`);
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={children as React.JSX.Element} />
      <DialogContent className="bg-bg-secondary border border-border-primary sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-text-primary font-display">
            Delete Portfolio
          </DialogTitle>
          <DialogDescription className="text-text-secondary">
            Are you sure you want to delete &quot;{portfolioName}&quot;? This
            will remove all holdings and lots. This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => setOpen(false)}
            className="text-text-secondary"
          >
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleDelete}>
            Delete Portfolio
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
