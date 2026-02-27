/** @type {import('next').NextConfig} */
const nextConfig = {
    async headers() {
        return [
            {
                // Apply to all routes
                source: '/(.*)',
                headers: [
                    // Allow embedding in any iframe from any origin
                    {
                        key: 'X-Frame-Options',
                        value: 'ALLOWALL',
                    },
                    // Override CSP to allow framing from anywhere
                    {
                        key: 'Content-Security-Policy',
                        value: "frame-ancestors *;",
                    },
                ],
            },
        ];
    },
};

module.exports = nextConfig;
