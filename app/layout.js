import './globals.css';

export const metadata = {
  title: 'Clawser',
  description: 'Leads and follow-ups for your sales team, in one place. A product by a1nnovate.',
  icons: { icon: '/icon.svg' },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#ffffff',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:opsz,wght@14..32,400..800&display=swap"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
