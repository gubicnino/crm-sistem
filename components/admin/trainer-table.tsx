import { DeactivateTrainerButton } from "@/components/admin/deactivate-trainer-button";
import { EnterTrainerButton } from "@/components/admin/enter-trainer-button";
import { FromEmailDialog } from "@/components/admin/from-email-dialog";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Trainer } from "@/db/schema";
import { sl } from "@/lib/strings";

export function TrainerTable({ trainers }: { trainers: Trainer[] }) {
  if (trainers.length === 0) {
    return <p className="text-muted-foreground">{sl.admin.empty}</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{sl.admin.columnName}</TableHead>
          <TableHead>{sl.admin.columnEmail}</TableHead>
          <TableHead>{sl.admin.columnSiteKey}</TableHead>
          <TableHead>{sl.admin.columnFromEmail}</TableHead>
          <TableHead>{sl.admin.columnStatus}</TableHead>
          <TableHead>{sl.admin.columnCreated}</TableHead>
          <TableHead />
        </TableRow>
      </TableHeader>
      <TableBody>
        {trainers.map((trainer) => {
          const isActive = !trainer.deactivatedAt;
          return (
            <TableRow key={trainer.id}>
              <TableCell>{trainer.name}</TableCell>
              <TableCell>{trainer.email}</TableCell>
              <TableCell className="font-mono text-xs">{trainer.siteKey}</TableCell>
              <TableCell className="max-w-56 truncate">{trainer.fromEmail ?? "—"}</TableCell>
              <TableCell>
                <Badge variant={isActive ? "secondary" : "destructive"}>
                  {isActive ? sl.admin.statusActive : sl.admin.statusDeactivated}
                </Badge>
              </TableCell>
              <TableCell>{trainer.createdAt.toLocaleDateString("sl-SI")}</TableCell>
              <TableCell>
                <div className="flex items-center justify-end gap-2">
                  {isActive && <EnterTrainerButton trainerId={trainer.id} />}
                  <FromEmailDialog trainerId={trainer.id} currentValue={trainer.fromEmail} />
                  <DeactivateTrainerButton trainerId={trainer.id} isActive={isActive} />
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
