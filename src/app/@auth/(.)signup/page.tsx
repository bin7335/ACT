import { AuthModalRoute } from "@/components/AuthModalRoute";

export default function SignupModalPage({ searchParams }: PageProps<"/signup">) {
  return <AuthModalRoute mode="signup" searchParams={searchParams} />;
}
