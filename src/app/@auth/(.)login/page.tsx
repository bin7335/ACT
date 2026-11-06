import { AuthModalRoute } from "@/components/AuthModalRoute";

export default function LoginModalPage({ searchParams }: PageProps<"/login">) {
  return <AuthModalRoute mode="login" searchParams={searchParams} />;
}
