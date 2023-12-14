import type { Meme } from "database/types";

/**
 * v0 by Vercel.
 * @see https://v0.dev/t/qRWgemPAZyQ
 */
export default function ImageGrid({ assets }: { assets: Meme[] | null }) {
  return (
    <section className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 p-4">
      {assets &&
        !!assets.length &&
        assets.map(
          (asset, index) =>
            asset.url && (
              <div
                className="p-2 border-2 border-dashed border-black rounded-lg"
                key={index}
              >
                <img
                  alt={"uploaded meme"}
                  className="object-cover w-full h-full rounded-lg"
                  height="200"
                  src={asset.url}
                  style={{
                    aspectRatio: "200/200",
                    objectFit: "cover",
                  }}
                  width="200"
                />
              </div>
            )
        )}
    </section>
  );
}
