import './globals.css';

export const metadata = {
  title: 'Growly',
  description: 'Weekly learning tracking dashboard',
};

export const viewport = { themeColor: '#36785a' };

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
