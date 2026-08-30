import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata = {
    title: 'Live Chat Support',
    description: 'Chat with us in real time',
    robots: {
        index: false,
        follow: false,
        googleBot: {
            index: false,
            follow: false,
        },
    },
};

export const viewport = {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
};


export default function RootLayout({ children }) {
    return (
        <html lang="en">
            <body className={inter.variable}>{children}</body>
        </html>
    );
}
