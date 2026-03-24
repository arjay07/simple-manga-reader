#!/bin/sh
set -e

cat > /etc/caddy/Caddyfile <<EOF
${PRIMARY_DOMAIN} {
	tls {
		dns ${DNS_PROVIDER} {env.DNS_TOKEN}
		resolvers 8.8.8.8
	}
	reverse_proxy manga-reader:3000
}
EOF

if [ -n "${SECONDARY_DOMAIN}" ]; then
  cat >> /etc/caddy/Caddyfile <<EOF

${SECONDARY_DOMAIN} {
	tls {
		dns ${DNS_PROVIDER} {env.DNS_TOKEN}
		resolvers 8.8.8.8
	}
	reverse_proxy manga-reader:3000
}
EOF
fi

cat >> /etc/caddy/Caddyfile <<EOF

:80 {
	reverse_proxy manga-reader:3000
}
EOF

exec caddy run --config /etc/caddy/Caddyfile
