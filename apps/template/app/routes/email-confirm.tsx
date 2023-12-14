import { useSearchParams } from "@remix-run/react";
import EmailConfirmUI from "~/components/email-confirm-ui";
export default function SomeComponent() {
  const [searchParams] = useSearchParams();

  // grab email
  const email = searchParams.get("email");
  return (
    <div className="min-h-screen w-full flex justify-center align-middle items-center">
      <EmailConfirmUI email={email ?? ""} />
    </div>
  );
}
