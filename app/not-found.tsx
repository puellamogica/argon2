import Image from "next/image";

export default function NotFound() {
  return (
    <div className="hero bg-base-200 min-h-full">
      <div className="hero-content flex-col lg:flex-row">
        <Image
          src="https://http.cat/404"
          alt="404 Not Found | HTTP Cats"
          width={750}
          height={600}
          className="max-w-sm rounded-lg shadow-2xl"
          unoptimized
          loading="eager"
        />
        <div>
          <h1>404 Not Found</h1>
          <p>
            The HTTP <code>404 Not Found</code> response status code indicates
            that the server cannot find the requested resource. Links that lead
            to a <code>404</code> page are often called broken or dead links and
            can be subject to link rot.
          </p>
          <p>
            A <code>404</code> status code only indicates that the resource is
            missing: not whether the absence is temporary or permanent. If a
            resource is permanently removed, use the <code>410 Gone</code>{" "}
            status instead.
          </p>
        </div>
      </div>
    </div>
  );
}
