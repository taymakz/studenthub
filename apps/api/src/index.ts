import app from "./server"

/**
 * Entry point (Bun). No worker on purpose - the notification fan-out is
 * driven by the dashboard's resumable send-next loop (see AGENTS.md), never
 * by a background process.
 */

const server = Bun.serve({
  fetch: app.fetch,
  port: Number(process.env.PORT ?? 8000),
})

console.log(`✅ API running at http://localhost:${server.port}`)
console.log(`   environment: ${process.env.APP_ENV ?? "development"}`)

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    console.log(`\n${signal} - shutting down`)
    server.stop(true)
    process.exit(0)
  })
}

process.on("uncaughtException", (error) => {
  console.error("Uncaught exception:", error)
})
process.on("unhandledRejection", (error) => {
  console.error("Unhandled rejection:", error)
})

export default server
