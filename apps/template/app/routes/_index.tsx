import {
  json,
  type ActionFunctionArgs,
  type MetaFunction,
  type LoaderFunctionArgs,
} from "@remix-run/cloudflare";
import { useLoaderData } from "@remix-run/react";
import { createServerClient } from "@supabase/auth-helpers-remix";
import type { Meme } from "database/types";
import ImageGrid from "~/components/image-grid";
import Login from "~/components/login";
import Upload from "~/components/upload-file";

export const meta: MetaFunction = () => {
  return [
    { title: "N4 Stack" },
    {
      name: "description",
      content: "The easiest way to store your favorite meme images",
    },
  ];
};

export const loader = async ({ request, context }: LoaderFunctionArgs) => {
  let env = context.env as Env;
  const db = env.DB;
  const response = new Response();
  const supabase = createServerClient(
    env.SUPABASE_URL!,
    env.SUPABASE_ANON_KEY!,
    {
      request,
      response,
    }
  );

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return json(
      {
        session,
        assets: null,
      },
      {
        headers: response.headers,
      }
    );
  }

  const { results } = await db
    .prepare("SELECT * FROM assets WHERE user_id = ? ORDER BY created_at DESC")
    .bind(session.user.id)
    .all<Meme>();
  return json(
    {
      session,
      assets: results,
    },
    {
      headers: response.headers,
    }
  );
};

export default function Index() {
  const { session, assets } = useLoaderData<typeof loader>();

  return (
    <div
      style={{ fontFamily: "system-ui, sans-serif", lineHeight: "1.8" }}
      className="flex text-center justify-center flex-col  min-h-screen w-full"
    >
      <div>
        <h1 className="mb-2">Welcome to package-name-replace</h1>
      </div>

      {session ? (
        <div>
          <Upload hasUploaded={!!assets} />
          {!!assets && <ImageGrid assets={assets} />}
        </div>
      ) : (
        <Login />
      )}
    </div>
  );
}
export async function action({ request, context }: ActionFunctionArgs) {
  const response = new Response();
  let env = context.env as Env;
  const supabase = createServerClient(
    env.SUPABASE_URL!,
    env.SUPABASE_ANON_KEY!,
    { request, response }
  );

  const formData = await request.formData();
  const email = String(formData.get("email"));
  const password = String(formData.get("password"));

  if (!email.includes("@")) {
    return json({
      error: "invalid email address",
      success: false,
    });
  }

  if (password.length < 8) {
    return json({
      error: "Password should be at least 8 characters",
      success: false,
    });
  }

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) {
    return json(
      {
        error: error.message,
        success: false,
      },
      {
        headers: response.headers,
      }
    );
  }
  // Redirect to dashboard if validation is successful
  return json(
    {
      error: null,
      success: true,
    },
    {
      headers: response.headers,
    }
  );
}
