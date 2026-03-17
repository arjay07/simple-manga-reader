#!/bin/sh
# Fix permissions on bind-mounted directories so nextjs user can write
chown -R nextjs:nodejs /manga /app/data /app/public/covers 2>/dev/null || true

# Drop to nextjs user and run the server
exec su -s /bin/sh nextjs -c "node server.js"
