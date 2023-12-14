/**
 * v0 by Vercel.
 * @see https://v0.dev/t/PZN87w0t5vU
 */

import { Link } from "@remix-run/react";
import { Button } from "./ui/button";

export default function EmailConfirmUI({ email }: { email: string }) {
  return (
    <section className="flex flex-col items-center justify-center space-y-6 h-screen bg-gray-100 dark:bg-gray-900 text-center px-4 sm:px-6 lg:px-8">
      <div className="max-w-md mx-auto">
        <h2 className="mt-6 text-3xl font-extrabold text-gray-900 dark:text-gray-100">
          Thank you for signing up for N4 Stack!
        </h2>
        <div className="mt-2 max-w-lg mx-auto text-base text-gray-600 dark:text-gray-300">
          <p>Your email confirmation is on its way! Please check your inbox.</p>
        </div>
        <Button className="mt-5 w-full py-3 px-4 border border-transparent text-base font-medium rounded-md text-white bg-green-600 hover:bg-green-700 md:py-4 md:text-lg md:px-10">
          <Link to="/">Go back to homepage</Link>
        </Button>
      </div>
    </section>
  );
}
