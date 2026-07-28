import { InviteTrainerCard } from "@/components/admin/invite-trainer-card";
import { TrainerTable } from "@/components/admin/trainer-table";
import { listAllTrainers } from "@/db/queries/admin";
import { sl } from "@/lib/strings";
import { requireAdmin } from "@/lib/tenant";

export default async function AdminPage() {
  await requireAdmin();
  const trainers = await listAllTrainers();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">{sl.admin.title}</h1>
      <InviteTrainerCard />
      <TrainerTable trainers={trainers} />
    </div>
  );
}
