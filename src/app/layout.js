import "./globals.css";

export const metadata = {
  title: "Vitto — Loan Servicing",
  description: "Loan servicing dashboard and payment management",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
