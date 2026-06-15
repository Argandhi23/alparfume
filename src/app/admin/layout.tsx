import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Admin Panel | AL PARFUME",
  description: "Dashboard administratif AL PARFUME.",
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="bg-brandWhite min-h-screen text-brandBlack">
      {children}
    </div>
  );
}
