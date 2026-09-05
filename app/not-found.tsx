import Image from "next/image";

export default function NotFound() {
  return (
    <main className="flex min-h-[70vh] flex-col items-center justify-center gap-4 text-center">
      <h1 className="text-3xl font-bold">404 Not Found</h1>
      <figure className="w-full max-w-3xl">
        <Image
          src="https://http.cat/404"
          alt="404 Not Found | HTTP Cats"
          className="w-full rounded-lg"
          width="750"
          height="600"
          unoptimized
          loading="eager"
        />
        <figcaption className="text-base-content/50 mt-2 text-sm">
          404 Not Found | HTTP Cats
        </figcaption>
      </figure>
      <p className="text-base-content/70 text-md max-w-3xl text-left">
        The HTTP <code>404 Not Found</code> response status code indicates that
        the server cannot find the requested resource. Links that lead to a{" "}
        <code>404</code> page are often called broken or dead links and can be
        subject to link rot.
        <br />A <code>404</code> status code only indicates that the resource is
        missing: not whether the absence is temporary or permanent. If a
        resource is permanently removed, use the <code>410 Gone</code> status
        instead.
      </p>
    </main>
  );
}
