import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RegisterForm } from "@/components/auth/register-form";
import { verifyInviteToken } from "@/lib/invites";
import { sl } from "@/lib/strings";

export default async function RegisterPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const invite = await verifyInviteToken(token);

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>{sl.auth.registerTitle}</CardTitle>
      </CardHeader>
      <CardContent>
        {invite ? (
          <RegisterForm token={token} email={invite.email} />
        ) : (
          <p className="text-sm text-destructive">{sl.auth.inviteInvalid}</p>
        )}
      </CardContent>
    </Card>
  );
}
