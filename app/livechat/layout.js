export default function LiveChatLayout({ children }) {
    return (
        <html lang="en">
            <body style={{ margin: 0, padding: 0, width: '100%', height: '100%', overflow: 'hidden' }}>
                {children}
            </body>
        </html>
    );
}
