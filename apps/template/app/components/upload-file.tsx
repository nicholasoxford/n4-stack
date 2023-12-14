/**
 * v0 by Vercel.
 * @see https://v0.dev/t/0pQC0AZkkMz
 */

import { useEffect, useRef, useState } from "react";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { useFetcher } from "@remix-run/react";
import { Button } from "./ui/button";
import { Loader2 } from "lucide-react";
export default function Upload({ hasUploaded }: { hasUploaded?: boolean }) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const hiddenInputRef = useRef<HTMLInputElement | null>(null);
  const [imageSrc, setImageSrc] = useState<string | ArrayBuffer>("");
  const fetcher = useFetcher();
  const data = fetcher.data;
  useEffect(() => {
    if (data && inputRef.current && hiddenInputRef.current) {
      inputRef.current.value = "";
      hiddenInputRef.current.value = "";
      setImageSrc(""); // Set imageSrc to an empty string
    }
  }, [data]);

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setImageSrc(e.target?.result ?? "");
      };
      reader.readAsDataURL(file);
    }
    //@ts-ignore
    inputRef.current.value = "";
    //@ts-ignore
    inputRef.current.files = e.dataTransfer.files;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (e) => {
        setImageSrc(e.target?.result ?? "");
      };
      reader.readAsDataURL(file);

      // @ts-ignore
      inputRef.current.files = e.target.files;
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };
  const isSubmitting = fetcher.state !== "idle";
  return (
    <fetcher.Form action="/upload" method="post" encType="multipart/form-data">
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        className={`
        ${hasUploaded ? "min-h-fit" : "min-h-screen"}
         w-full flex flex-col items-center justify-center bg-zinc-100/40 dark:bg-zinc-800/40`}
      >
        <div className="w-10/12 md-w-8/12 lg:w-6/12 max-w-2xl p-10 border-4 border-dashed border-zinc-600 dark:border-zinc-400 rounded-lg">
          <div className="flex flex-col items-center gap-6">
            <svg
              className=" h-24 w-24 text-zinc-600 dark:text-zinc-400"
              fill="none"
              height="24"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              width="24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" x2="12" y1="3" y2="15" />
            </svg>
            <div className="text-2xl font-bold text-zinc-600 dark:text-zinc-400">
              Drag & Drop your image here
            </div>
            <div className="text-zinc-500 dark:text-zinc-400">or</div>
            <div className="grid w-full max-w-sm items-center gap-1.5">
              <Label htmlFor="picture">Picture</Label>
              <Input
                ref={inputRef}
                onChange={handleInputChange}
                id="picture"
                type="file"
                name="picture"
              />
            </div>
            <input
              ref={hiddenInputRef}
              className="hidden "
              onChange={handleInputChange}
              id="pictureDrop"
              type="file"
              name="pictureDrop"
            />
            {!isSubmitting ? (
              <Button
                type="submit"
                className="w-2/3 mt-10 bg-green-500 text-white py-2 rounded-lg"
              >
                {" "}
                Submit
              </Button>
            ) : (
              <Button
                disabled
                className="w-2/3 mt-10 bg-gray-500 text-white py-2 rounded-lg"
              >
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Please wait
              </Button>
            )}
            {imageSrc && (
              <div className="mt-10">
                <img
                  alt="Uploaded img"
                  className="aspect-square object-cover w-full rounded-lg overflow-hidden "
                  height={200}
                  src={imageSrc as string}
                  width={200}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </fetcher.Form>
  );
}
