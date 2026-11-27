import http from "node:http";

const routes = [
  { prefix: "/api/tasks", target: Number(process.env.TASKS_PORT || 4001) },
  { prefix: "/api/projects", target: Number(process.env.TASKS_PORT || 4001) },
  { prefix: "/api/calendar", target: Number(process.env.CALENDAR_PORT || 4002) },
  { prefix: "/api/notifications", target: Number(process.env.NOTIFICATIONS_PORT || 4003) },
  { prefix: "/api/routine", target: Number(process.env.ROUTINE_PORT || 4004) },
];

const port = Number(process.env.GATEWAY_PORT || 4000);

const server = http.createServer((req, res) => {
  const route = routes.find((r) => req.url.startsWith(r.prefix));
  if (!route) {
    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "Route inconnue", url: req.url }));
    return;
  }
  const proxyReq = http.request(
    {
      host: "localhost",
      port: route.target,
      path: req.url,
      method: req.method,
      headers: { ...req.headers, host: `localhost:${route.target}` },
    },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res);
    }
  );
  proxyReq.on("error", (err) => {
    res.writeHead(502, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: `Service indisponible sur le port ${route.target}`, detail: err.message }));
  });
  req.pipe(proxyReq);
});

server.listen(port, () => {
  console.log(`[gateway] prêt sur http://localhost:${port}`);
});
